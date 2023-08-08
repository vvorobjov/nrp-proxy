'use strict';

const fs = require('fs'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path'),
  assert = chai.assert,
  q = require('q'),
  sinon = require('sinon'),
  chaiSubset = require('chai-subset'),
  fse = require('fs-extra'),
  tmp = require('tmp'),
  zip = require('zip-a-folder');
chai.use(chaiAsPromised);
chai.use(chaiSubset);
const config = `<?xml version='1.0'?>
<model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://schemas.humanbrainproject.eu/SP10/2017/model_config" xsi:schemaLocation="http://schemas.humanbrainproject.eu/SP10/2017/model_config ../model_configuration.xsd">
  <name>HBP Clearpath Robotics Husky A200</name>
  <version>1.0</version>
  <sdf version="1.5">model.sdf</sdf>
  <brain>extended_braitenberg.py</brain>
  <author>
    <name>Ryan Gariepy</name>
    <email>rgariepy@clearpathrobotics.com</email>
    <name>Oliver Zweigle</name>
    <email>zweigle@fzi</email>
  </author>
  <description>
    Clearpath Robotics Husky A200 - Extended HBP Model
  </description>
</model>
`;
let StorageRequestHandlerRewire = rewire('../../storage/requestHandler'),
  StorageRequestHandler = StorageRequestHandlerRewire.default;

class fakeCloner {
  constructor() {}

  cloneExperiment() {}
}

class ExperimentImporter {
  constructor() {}

  registerZippedExperiment() {
    return q.resolve('zippedExperiment');
  }

  scanStorage() {
    return q.resolve('scanStorage');
  }
}

class ExperimentZipper {
  constructor() {}

  zipExperiment() {
    return q.resolve('zipExperiment');
  }
}

StorageRequestHandlerRewire.__set__('TemplateExperimentCloner', fakeCloner);
StorageRequestHandlerRewire.__set__('NewExperimentCloner', fakeCloner);
StorageRequestHandlerRewire.__set__(
  'experimentImporter.ExperimentImporter',
  ExperimentImporter
);
StorageRequestHandlerRewire.__set__(
  'experimentZipper.ExperimentZipper',
  ExperimentZipper
);

let configFile = {
  storage: 'FS',
  authentication: 'FS'
};

//Storage request handler
describe('Storage request handler', () => {
  let RewiredDB,
    RewiredFSAuthenticator,
    RewiredFSStorage,
    RewiredIdentity,
    fsAuthenticator,
    storageRequestHandler,
    fsStorage,
    identity;

  var collectionMock = sinon.stub();
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24',
    fakeUserId = 'nrpuser',
    fakeExperiment = '21f0f4e0-9753-42f3-bd29-611d20fc1168',
    AUTHORIZATION_ERROR = {
      code: 403
    };

  const originalStatSync = fs.statSync;
  const fakeStatSync = file => {
    const stat = originalStatSync(file);
    stat.mtime = new Date('Tue Apr 17 2018 09:38:40 GMT+0200 (CEST)');
    return stat;
  };

  const originalLstatSync = fs.lstatSync;
  const fakeLstatSync = directory => {
    const dir = originalLstatSync(directory);
    dir.isDirectory = () => true;
    return dir;
  };

  const fakeReadDirSync = () => [
    'experiment_configuration.exc',
    'ExDXMLExample.jpg',
    'all_neurons_spike_monitor.py',
    'bibi_configuration.bibi'
  ];

  let mkdirCalls = 0;
  let rmdirCalls = 0;
  beforeEach(async () => {
    const mockUtils = {
      storagePath: path.join(__dirname, 'dbMock')
    };
    RewiredDB = rewire('../../storage/FS/DB');
    RewiredDB.__set__('utils', mockUtils);
    RewiredDB.__set__('DBCollection', collectionMock);
    const RewiredGDPR = rewire('../../storage/GDPR');
    RewiredGDPR.__set__('DB', RewiredDB.default);
    StorageRequestHandlerRewire.__set__('GDPR', RewiredGDPR.default);

    storageRequestHandler = new StorageRequestHandler(configFile);
    await storageRequestHandler.loadDependenciesInjection();
    collectionMock.prototype.delete = sinon
      .stub()
      .returns(Promise.resolve('value'));
    collectionMock.prototype.insert = sinon
      .stub()
      .returns(Promise.resolve('value'));
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve('value'));
    collectionMock.prototype.find = sinon
      .stub()
      .returns(Promise.resolve('value'));
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve('value'));
    collectionMock.prototype.remove = sinon
      .stub()
      .returns(Promise.resolve('value'));

    RewiredFSStorage = rewire('../../storage/FS/Storage');
    RewiredFSStorage.__set__('DB', RewiredDB.default);
    RewiredFSStorage.__set__('utils', mockUtils);
    RewiredIdentity = rewire('../../storage/FS/Identity');
    RewiredIdentity.__set__('DB', RewiredDB.default);
    mkdirCalls = 0;

    var fakeMkdir = (path, callback) => {
      mkdirCalls++;
      callback();
    };

    var fakeRmdir = (path, callback) => {
      rmdirCalls++;
      callback();
    };

    var fakeUnlink = (path, callback) => {
      callback();
    };
    RewiredFSStorage.__set__('fs.statSync', fakeStatSync);
    RewiredFSStorage.__set__('fs.mkdir', fakeMkdir);
    RewiredFSStorage.__set__('rmdir', fakeRmdir);
    RewiredFSStorage.__set__('fs.lstatSync', fakeLstatSync);
    RewiredFSStorage.__with__('fs.readdirSync', fakeReadDirSync);
    RewiredFSStorage.__set__('fs.unlink', fakeUnlink);
    fsStorage = new RewiredFSStorage.Storage();
    RewiredFSAuthenticator = rewire('../../storage/FS/Authenticator');
    RewiredFSAuthenticator.__set__('DB', RewiredDB.default);
    fsAuthenticator = new RewiredFSAuthenticator.Authenticator();
    identity = new RewiredIdentity.Identity();
    storageRequestHandler.authenticator = fsAuthenticator;
    storageRequestHandler.storage = fsStorage;
    storageRequestHandler.identity = identity;
  });

  it('should authenticate successfully', () => {
    collectionMock.prototype.findOne = sinon.stub().returns(
      Promise.resolve({
        token: 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24'
      })
    );

    return storageRequestHandler
      .authenticate('nrpuser', 'password')
      .should.eventually.equal(fakeToken);
  });

  it.skip('should detect user that has not accepted gdpr', () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve('userId'));

    return storageRequestHandler
      .getGDPRStatus('nrpuser')
      .should.eventually.deep.equal({
        gdpr: false
      });
  });
  /*models*/

  it(`should succesfully get the sharing option of the Model`, () => {
    collectionMock.prototype.findOne = sinon.stub().returns(
      Promise.resolve({
        sharingOption: 'Private'
      })
    );
    return storageRequestHandler
      .getModelSharingMode('fakeModelType', 'fakeModelId')
      .then(res =>
        expect(res).to.deep.equal({
          sharingOption: 'Private'
        })
      );
  });

  it('should add a user into the shared users list', () => {
    collectionMock.prototype.insert = sinon
      .stub()
      .returns(Promise.resolve('userId'));
    storageRequestHandler
      .addUsertoSharingUserListinModel(
        'fakeModelType',
        'fakeModelType',
        'userId'
      )
      .should.eventually.deep.equal(true);
  });

  it(`should get the list of shared userss by Model`, () => {
    var expectedResult = ['nrpuser', 'admin'];
    collectionMock.prototype.findOne = sinon.stub().returns(
      Promise.resolve({
        sharingUsers: ['nrpuser', 'admin']
      })
    );
    return storageRequestHandler
      .listSharingUsersbyModel('modelType', 'modelname', fakeToken)
      .then(userList => {
        expect(userList).to.deep.equal(expectedResult);
      });
  });

  it(`should succesfully update the sharing option of the model`, () => {
    var expected = [
      1,
      {
        updatedExisting: true,
        n: 1
      }
    ];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expected));
    return storageRequestHandler
      .updateSharedModelMode('fakeModelType', 'fakeModelId', 'public')
      .then(res => {
        expect(res).to.deep.equal(expected);
      });
  });

  it(`should succesfully get the sharing option of the experiment`, () => {
    collectionMock.prototype.findOne = sinon.stub().returns(
      Promise.resolve({
        data: 'Private'
      })
    );
    return storageRequestHandler
      .getExperimentSharingMode('fakeModelType', 'fakeModelId')
      .then(res =>
        expect(res).to.deep.equal({
          data: 'Private'
        })
      );
  });

  it(`should succesfully delete a shared users`, () => {
    var expected = [
      1,
      {
        updatedExisting: true,
        n: 1
      }
    ];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expected));
    return storageRequestHandler
      .deleteSharingUserFromModel('fakeModelType', 'fakeModelId', 'userId')
      .then(res => expect(res).to.deep.equal(expected));
  });

  it(`should get the model Path of an specific model`, () => {
    storageRequestHandler.getUserIdentifier = () => q.resolve('test 0');
    storageRequestHandler.storage.getModelPath = function() {
      return q.when([
        {
          path: 'foldername'
        }
      ]);
    };

    return storageRequestHandler
      .getModelPath('robots', 'name', 'userid')
      .should.eventually.deep.include({ path: 'foldername' });
  });

  it(`should get the config full-path of a specific model`, () => {
    storageRequestHandler.getUserIdentifier = () => q.resolve('test 0');
    storageRequestHandler.storage.getModelConfigFullPath = function() {
      return '/home/user/.opt/nrpStorage/USER_DATA/robots/husky/model.config';
    };
    storageRequestHandler.storage.listAllModels = function() {
      return q.when([
        {
          name: 'husky',
          path: '/path',
          type: 'robots',
          isCustom: true
        },
        {
          name: 'p3dx',
          path: '/path2',
          type: 'robots',
          isCustom: true
        }
      ]);
    };

    return storageRequestHandler
      .getModelConfigFullPath('robots', 'husky', 'userid')
      .should.eventually.equal(
        '/home/user/.opt/nrpStorage/USER_DATA/robots/husky/model.config'
      );
  });

  it(`should correctly return the shared models`, () => {
    storageRequestHandler.modelsService.getZipModelMetaData = function() {
      return q.when(config);
    };
    storageRequestHandler.getUserIdentifier = () => q.resolve('test 0');
    storageRequestHandler.authenticator.checkToken = () => q.resolve('nrpuser');

    storageRequestHandler.storage.listSharedModels = function() {
      return q.when([
        {
          name: 'hbp_clearpath_robotics_husky_a200',
          type: 'robots',
          path: 'husky_model'
        }
      ]);
    };
    storageRequestHandler.storage.getModelZip = function() {
      return q.when([
        {
          path: 'foldername',
          data: []
        }
      ]);
    };

    return storageRequestHandler
      .listSharedModels('robots', fakeToken)
      .should.eventually.deep.include(config);
  });

  it(`should correctly return all models`, () => {
    storageRequestHandler.modelsService.getZipModelMetaData = function() {
      return q.when(config);
    };
    storageRequestHandler.getUserIdentifier = () => q.resolve('test 0');
    storageRequestHandler.authenticator.checkToken = () => q.resolve('nrpuser');

    storageRequestHandler.storage.listAllModels = function() {
      return q.when([
        {
          name: 'hbp_clearpath_robotics_husky_a200',
          type: 'robots',
          path: 'husky_model'
        }
      ]);
    };
    storageRequestHandler.storage.getModelZip = function() {
      return q.when([
        {
          path: 'husky_model',
          data: []
        }
      ]);
    };

    return storageRequestHandler
      .listAllModels('robots', fakeToken)
      .should.eventually.deep.include(config);
  });

  it.skip('should set user accepted gdpr', () => {
    collectionMock.prototype.insert = sinon
      .stub()
      .returns(Promise.resolve('userId'));

    return storageRequestHandler
      .acceptGDPRStatus('nrpuser')
      .should.eventually.deep.equal(true);
  });

  it('should clone experiment successfully', () => {
    return storageRequestHandler
      .cloneExperiment(fakeToken, 'new', 'contextId')
      .should.eventually.equal(undefined);
  });

  it('should clone a new experiment successfully', () => {
    return storageRequestHandler
      .cloneNewExperiment(fakeToken, 'new', 'contextId')
      .should.eventually.equal(undefined);
  });

  //listFiles
  it(`should list all the files contained in a certain experiment`, async () => {
    const files = await storageRequestHandler.listFiles(
      fakeExperiment,
      fakeToken,
      fakeUserId
    );
    return expect(files[0]).to.containSubset({
      name: 'fakeFile',
      uuid: '21f0f4e0-9753-42f3-bd29-611d20fc1168/fakeFile',
      size: 11,
      type: 'file',
      modifiedOn: new Date('Tue Apr 17 2018 09:38:40 GMT+0200 (CEST)')
    });
  });

  it(`should throw authorization exception when calling the listFiles function with wrong parameters`, () => {
    return assert.isRejected(
      storageRequestHandler.listFiles('fakeToken', fakeExperiment),
      AUTHORIZATION_ERROR
    );
  });

  //deleteFile
  it(`should succesfully delete a file given the correct data`, () => {
    const tmpFilePath = path.join(
      __dirname,
      'dbMock/' + fakeExperiment + '/tmp'
    );
    //create a temp file to be deleted
    return q
      .denodeify(fs.writeFile)(tmpFilePath, 'fakeContent')
      .then(() => {
        //delete the temp file
        return storageRequestHandler
          .deleteFile(fakeExperiment + '/tmp', fakeExperiment, fakeToken)
          .then(() => {
            //check if the file was indeed deleted
            return expect(
              storageRequestHandler.listFiles(fakeExperiment, fakeToken)
            )
              .to.eventually.be.an('array')
              .that.not.include('tmp');
          });
      });
  });

  it(`should get the list of the users`, () => {
    var expectedResult = [
      {
        displayName: 'nrpuser',
        id: 'nrpuser',
        username: 'nrpuser'
      },
      {
        displayName: 'admin',
        id: 'admin',
        username: 'admin'
      }
    ];
    collectionMock.prototype.find = sinon.stub().returns(
      Promise.resolve([
        {
          user: 'nrpuser'
        },
        {
          user: 'admin'
        }
      ])
    );
    return storageRequestHandler.getUsersList(fakeToken).then(userList => {
      expect(userList).to.deep.equal(expectedResult);
    });
  });

  it(`should create a new shared Experiment when we call the addExperimentSharedUserByUser`, () => {
    var expectedResult = [
      {
        uuid: fakeExperiment,
        name: fakeExperiment
      }
    ];
    var adminToken = '1d3409e4-8a4e-409d-b6c7-58dacc4b833e';
    collectionMock.prototype.find = sinon.stub().returns(
      Promise.resolve([
        {
          experiment: fakeExperiment
        }
      ])
    );

    return storageRequestHandler
      .addUsertoSharingUserListinExperiment(
        fakeExperiment,
        'admin',
        fakeToken,
        'contextId'
      )
      .then(() =>
        storageRequestHandler
          .listExperimentsSharedByUsers(adminToken)
          .then(folderContents => {
            expect(folderContents).to.deep.equal(expectedResult);
          })
      );
  });

  it(`should succesfully update the sharing option of the experiment`, () => {
    var expected = [
      1,
      {
        updatedExisting: true,
        n: 1
      }
    ];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expected));
    return storageRequestHandler
      .updateSharedExperimentMode('fakeExperiment', 'public')
      .then(res => {
        expect(res).to.deep.equal(expected);
      });
  });

  it(`should succesfully delete all sharing users`, () => {
    var expected = [1, { updatedExisting: true, n: 1 }];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expected));
    return storageRequestHandler
      .deleteSharingUserFromExperiment('fakeExperiment', 'all')
      .then(res => expect(res).to.deep.equal(expected));
  });

  it(`should succesfully delete a sharing users`, () => {
    var expected = [
      1,
      {
        updatedExisting: true,
        n: 1
      }
    ];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expected));
    return storageRequestHandler
      .deleteSharingUserFromExperiment('fakeExperiment', 'userId')
      .then(res => expect(res).to.deep.equal(expected));
  });

  it(`should succesfully get the sharing option of the experiment`, () => {
    collectionMock.prototype.findOne = sinon.stub().returns(
      Promise.resolve({
        data: 'Private'
      })
    );
    return storageRequestHandler
      .getExperimentSharingMode('fakeExperiment', 'userId')
      .then(res =>
        expect(res).to.deep.equal({
          data: 'Private'
        })
      );
  });

  it(`should succesfully get the list of the sharing users by experiment`, () => {
    var dbresult = {
      token: 'user0',
      experiment: 'benchmark_p3dx_0',
      _id: 5,
      shared_users: ['user1'],
      shared_option: 'Shared'
    };
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve(dbresult));
    return storageRequestHandler
      .listSharingUsersbyExperiment('fakeExperiment', 'token')
      .then(res => expect(res).to.deep.equal(dbresult.shared_users));
  });

  it(`should succesfully list all customs models`, () => {
    var expectedResult = {
      name: 'modelname',
      path: 'folder/filename',
      ownerName: 'userId',
      type: 'robots'
    };
    collectionMock.prototype.find = sinon.stub().returns(
      Promise.resolve([
        {
          name: 'modelname',
          path: 'folder/filename',
          ownerName: 'userId',
          type: 'robots'
        }
      ])
    );

    return storageRequestHandler
      .listModelsbyType('customFolder', 'token', 'userId', 'contextId')
      .then(res => expect(res[0]).to.deep.equal(expectedResult));
  });

  it(`should succesfully create or update all customs models`, () => {
    class StorageMock {
      async createOrUpdate() {
        return 'value';
      }
    }

    storageRequestHandler.storage = new StorageMock();
    return storageRequestHandler
      .createOrUpdate(
        'filename',
        'fileContent',
        'contentType',
        'parentDir',
        'token'
      )
      .then(res => expect(res).to.deep.equal('value'));
  });

  it(`should fail to find a custom model which is not in the database`, () => {
    const robot = 'husky.zip';
    storageRequestHandler.getUserIdentifier = () => q.resolve('test 0');
    storageRequestHandler.authenticator.checkToken = () => q.resolve('nrpuser');

    collectionMock.prototype.findOne = sinon.stub().returns(q.resolve(null));

    return storageRequestHandler
      .deleteCustomModel('robots', 'husky.zip', 'userId')
      .catch(res =>
        expect(res).to.deep.equal(
          `The model: ${robot} does not exist in the Models database.`
        )
      );
  });

  it(`should fail to delete a custom model which is not in the FS`, () => {
    const robot = 'husky.zip';
    RewiredFSStorage.__set__('fs.unlink', () => q.reject());
    collectionMock.prototype.findOne = sinon.stub().returns(
      Promise.resolve({
        fileName: robot,
        token: 'token',
        type: 'robot'
      })
    );

    return storageRequestHandler
      .deleteCustomModel('robots', 'husky.zip', 'userId')
      .catch(res =>
        expect(res).to.deep.equal(
          `Could not find the model ${robot} to remove in the user storage.`
        )
      );
  });

  it(`should not delete a custom model from the FS even when it fails to remove it from the DB`, () => {
    const robot = 'husky.zip';
    collectionMock.prototype.findOne = sinon.stub().returns(
      Promise.resolve({
        fileName: robot,
        token: 'token',
        type: 'robot'
      })
    );

    collectionMock.prototype.remove = sinon
      .stub()
      .returns(Promise.resolve(null));

    return storageRequestHandler
      .deleteCustomModel('robots', 'husky.zip', 'userId', 'userId')
      .catch(res =>
        expect(res).to.deep.equal(
          `Could not find the model ${robot} to remove in the user storage.`
        )
      );
  });

  it(`should succesfully delete a custom model`, () => {
    const robot = 'husky';
    collectionMock.prototype.findOne = sinon.stub().returns(
      Promise.resolve({
        fileName: robot,
        token: 'shouldsuccesstoken',
        type: 'shouldsuccessrobot',
        path: 'shouldsuccesspath'
      })
    );
    collectionMock.prototype.remove = sinon.stub().returns(
      Promise.resolve({
        value: 1
      })
    );
    return storageRequestHandler
      .deleteCustomModel('robots', 'husky', 'userId')
      .then(res =>
        expect(res).to.deep.equal(
          `Succesfully deleted model ${robot} from the user storage.`
        )
      );
  });

  it(`should fail to delete a custom model which is not in the storage`, () => {
    const robot = 'husky';
    return storageRequestHandler
      .deleteCustomModel('robots', robot, 'userId')
      .catch(res =>
        expect(res).to.deep.equal(
          `Could not find the model ${robot} to remove in the user storage.`
        )
      );
  });

  //deleteFile
  it(`should succesfully delete an Experiment`, () => {
    return storageRequestHandler
      .deleteExperiment('fakeExperiment', 'fakeExperiment', fakeToken)
      .then(res => expect(res).to.be.undefined);
  });

  //create folder
  it(`should call mkdir when creating folder`, () => {
    //create a tmp file
    return storageRequestHandler
      .createFolder('tmp_folder', fakeExperiment, fakeToken)
      .then(() => expect(mkdirCalls).to.equal(1));
  });

  //delete folder
  it(`should call rmdir when deleting folder createFolder`, () => {
    //create a tmp file
    return storageRequestHandler
      .deleteFolder(fakeExperiment + '/*tmp_folder', fakeExperiment, fakeToken)
      .then(() => expect(rmdirCalls).to.equal(2));
  });

  //listExperiments
  it(`should list all the experiments the current token provides`, () => {
    /*  const mockedLstatsync = () => { };
         StorageRequestHandler.__set__('fs.lstatSync', mockedLstatsync);
         var storageRequestHandler2 = new StorageRequestHandler(configFile); */
    const expected = {
      uuid: fakeExperiment,
      name: fakeExperiment,
      owned: true
    };
    collectionMock.prototype.find = sinon.stub().returns(
      Promise.resolve([
        {
          experiment: fakeExperiment
        }
      ])
    );

    return storageRequestHandler
      .listExperiments(fakeToken)
      .should.eventually.contain(expected);
  });

  //copyExperiment
  it(`should copy an experiment based on it's id`, () => {
    storageRequestHandler.storage.copyExperiment = function() {
      return new Promise(function(resolve) {
        resolve('success');
      });
    };
    return storageRequestHandler
      .copyExperiment('Exp_0', fakeToken, 'contextId')
      .should.eventually.equal('success');
  });

  //getFile
  it(`should return the contents of a file given a correct experiment and token`, () => {
    return storageRequestHandler
      .getFile(fakeExperiment + '/fakeFile', fakeExperiment, fakeToken)
      .then(val => {
        var stringContents = String.fromCharCode.apply(
          null,
          new Uint8Array(val.body)
        );
        return expect(stringContents).to.contain('fakeContent');
      });
  });

  //getFile
  it(`should obtain the login page`, () => {
    return storageRequestHandler
      .getLoginPage()
      .should.eventually.contain('storage/FS/login.html');
  });

  it(`should correctly return the user custom files`, () => {
    storageRequestHandler.modelsService.getZipModelMetaData = function() {
      return q.when(config);
    };
    storageRequestHandler.getUserIdentifier = () => q.resolve('test 0');
    storageRequestHandler.authenticator.checkToken = () => q.resolve('nrpuser');

    storageRequestHandler.storage.listUserModelsbyType = function() {
      return q.when([
        {
          modelType: 'robots',
          fileName: 'husky_model.zip'
        }
      ]);
    };
    storageRequestHandler.storage.getModelZip = function() {
      return q.when([
        {
          data: []
        }
      ]);
    };

    return storageRequestHandler
      .listUserModelsbyType('robots', fakeToken)
      .should.eventually.deep.include(config);
  });

  // getUserInfo success
  it(`should successfully return the user info`, () => {
    collectionMock.prototype.findOne = sinon.stub().returns(
      Promise.resolve({
        user: 'nrpuser'
      })
    );

    return storageRequestHandler
      .getUserInfo('nrpuser', fakeToken)
      .should.eventually.deep.equal({
        id: 'nrpuser',
        displayName: 'nrpuser'
      });
  });

  // getUserGroups success
  it(`should successfully return the group info`, () => {
    return storageRequestHandler.getUserGroups(fakeToken).then(resp => {
      resp[0].should.deep.equal('hbp-sp10-user-edit-rights');
    });
  });

  // createZip success
  it(`should successfully create a custom model`, () => {
    let fakeModel = {
      ownerName: 'ownerName',
      name: 'ownerName',
      type: 'type',
      path: 'path'
    };
    storageRequestHandler.storage.createCustomModel = function() {
      return q.when('test 1');
    };
    return storageRequestHandler
      .createCustomModel(fakeModel, 'test.zip', null)
      .should.eventually.equal('test 1');
  });

  // createZip fails
  it(`should throw when trying to create a corrupt zip`, () => {
    return assert.isRejected(
      storageRequestHandler.createZip(
        fakeToken,
        'robots',
        'test.zip',
        'fakeZip',
        null
      ),
      "Can't find end of central directory"
    );
  });
  // createZip succeeds
  it(`should create a zip`, () => {
    var fakeCustomModels = {
      getZipModelMetaData: function() {
        return q.when(config);
      },
      validateZip: function() {
        return q.when('test 3');
      },
      extractFileFromZip: function() {
        return q.when(config);
      }
    };
    StorageRequestHandlerRewire.__set__('modelsService', fakeCustomModels);
    var storageRequestHandler2 = new StorageRequestHandler(configFile);
    storageRequestHandler2.createCustomModel = function() {
      return 'success';
    };
    return storageRequestHandler2
      .createZip(fakeToken, 'robots', 'test.zip', 'fakeZip', null)
      .should.eventually.equal('success');
  });

  it(`should create a temporary zip of a given custom model`, () => {
    sinon.stub(storageRequestHandler, 'getStoragePath').returns('storagePath');
    sinon.stub(fse, 'copySync');
    sinon.stub(tmp, 'dirSync').returns({ name: 'tmp-folder' });
    sinon.stub(tmp, 'fileSync').returns({ name: 'tmp-folder' });
    sinon.stub(zip, 'zip');

    const zips = {
      envZip: { path: 'envPath', name: 'envName' },
      robotZips: []
    };
    const robotZip = {
      path: 'tmp-folder',
      name: 'hbp_clearpath_robotics_husky_a200.zip'
    };
    const customRobots = [
      {
        name: 'hbp_clearpath_robotics_husky_a200',
        path: 'husky_model15',
        type: 'robots',
        isCustom: true
      }
    ];
    const model = {
      _model: 'hbp_clearpath_robotics_husky_a200',
      _robotId: 'hbp_clearpath_robotics_husky_a200_0'
    };
    return storageRequestHandler
      .createTmpModelZip(zips, model, customRobots)
      .then(d => expect(d).to.deep.equal(robotZip));
  });

  // getStoragePath
  it(`should get the storage path from the storage instance`, () => {
    sinon.stub(fsStorage, 'getStoragePath').returns('storagePath');
    expect(storageRequestHandler.getStoragePath()).to.equal('storagePath');
  });

  // registerZippedExperiment
  it(`should register zipped experiment`, () => {
    storageRequestHandler.getUserIdentifier = () => q.resolve('test 0');
    storageRequestHandler.authenticator.checkToken = () => q.resolve('nrpuser');
    return storageRequestHandler
      .registerZippedExperiment()
      .should.eventually.equal('zippedExperiment');
  });

  // scanStorage
  it(`should scan storage`, () => {
    storageRequestHandler.getUserIdentifier = () => q.resolve('test 0');
    storageRequestHandler.authenticator.checkToken = () => q.resolve('nrpuser');
    return storageRequestHandler
      .scanStorage()
      .should.eventually.equal('scanStorage');
  });

  // getExperimentZips
  it(`should get the experiment zip`, () => {
    sinon.stub(fsStorage, 'getStoragePath').returns('storagePath');
    const result = {
      experimentZip: { path: 'zipExperiment', name: 'experimentId.zip' }
    };
    return storageRequestHandler
      .getExperimentZips('experimentId', 'token')
      .should.eventually.deep.equal(result);
  });

  // getExperimentZips
  it(`should fail to get the experiment zips if the experimentZipper throws`, () => {
    class ExperimentZipper {
      constructor() {}

      zipExperiment() {
        return q.reject('zipExperimentFail');
      }
    }

    StorageRequestHandlerRewire.__set__(
      'experimentZipper.ExperimentZipper',
      ExperimentZipper
    );
    let bibi = {
      bodyModel: {
        _model: 'hbp_clearpath_robotics_husky_a200',
        _isCustom: 'true',
        _robotId: 'husky'
      }
    };
    let exc = { environmentModel: { _model: 'text.zip' } };
    return assert.isRejected(
      storageRequestHandler.getExperimentZips(
        'experimentId',
        'token',
        bibi,
        exc
      ),
      'zipExperimentFail'
    );
  });

  it('should return an empty list of KG brains when using the local storage', () => {
    sinon
      .stub(storageRequestHandler, 'get')
      .onFirstCall()
      .returns({ body: JSON.stringify({}) })
      .onSecondCall()
      .returns({ body: 'script1' })
      .onThirdCall()
      .returns({ body: 'script2' });

    storageRequestHandler.config.authentication = 'FS';

    return storageRequestHandler
      .getKnowledgeGraphBrains('query', 'token')
      .should.eventually.deep.equal([]);
  });

  it('should get the list of KG brains', () => {
    const kgBrains = {
      results: [
        {
          file_url:
            'https://raw.githubusercontent.com/HBPNeurorobotics/knowledge-graph/master/Models/brain_model/CDP1_brain_model_700_neurons.h5',
          point_neuron_models: [
            {
              name: 'Adaptive Integrate and Fire model'
            }
          ],
          synpase_scale_factor: '68400',
          neuron_scale_factor: '717',
          name: 'whole mouse brain model',
          description:
            'This point neuron model has  717 neurons of type AIF and 68400 synapses of type Tsodyks-Markram.\nIt has been re-constructed base on data provided by Allen  Institute for Brain Science. ',
          '@id':
            'https://nexus-int.humanbrainproject.org/v0/data/sp6/core/pointneuronnetwork/v1.0.0/66391b53-bf32-4c3d-9c6a-cc8c4f810ae2',
          version: '0.1',
          synapse_models: {
            'https://schema.hbp.eu/relativeUrl':
              'sp6/core/synapsemodel/v1.0.0/ffb5b67e-e88b-416e-82ce-819edd3c9192',
            '@id':
              'https://nexus-int.humanbrainproject.org/v0/data/sp6/core/synapsemodel/v1.0.0/ffb5b67e-e88b-416e-82ce-819edd3c9192'
          },
          file_loader:
            'https://raw.githubusercontent.com/HBPNeurorobotics/knowledge-graph/master/Models/brain_model/CDP1_brain.py',
          publications: {
            'https://schema.hbp.eu/relativeUrl':
              'sp6/core/publication/v1.0.0/20572429-5c82-41ca-8a9a-67e35d9c1c25',
            '@id':
              'https://nexus-int.humanbrainproject.org/v0/data/sp6/core/publication/v1.0.0/20572429-5c82-41ca-8a9a-67e35d9c1c25'
          }
        },
        {
          file_url:
            'https://raw.githubusercontent.com/HBPNeurorobotics/knowledge-graph/master/Models/brain_model/CDP1_brain_model_700_neurons.h5',
          point_neuron_models: [
            {
              name: 'Adaptive Integrate and Fire model 2'
            }
          ],
          synpase_scale_factor: '68400',
          neuron_scale_factor: '717',
          name: 'whole mouse brain model',
          description:
            'This point neuron model has  717 neurons of type AIF and 68400 synapses of type Tsodyks-Markram.\nIt has been re-constructed base on data provided by Allen  Institute for Brain Science. ',
          '@id':
            'https://nexus-int.humanbrainproject.org/v0/data/sp6/core/pointneuronnetwork/v1.0.0/66391b53-bf32-4c3d-9c6a-cc8c4f810ae2b',
          version: '0.1',
          synapse_models: {
            'https://schema.hbp.eu/relativeUrl':
              'sp6/core/synapsemodel/v1.0.0/ffb5b67e-e88b-416e-82ce-819edd3c9192',
            '@id':
              'https://nexus-int.humanbrainproject.org/v0/data/sp6/core/synapsemodel/v1.0.0/ffb5b67e-e88b-416e-82ce-819edd3c9192'
          },
          file_loader:
            'https://raw.githubusercontent.com/HBPNeurorobotics/knowledge-graph/master/Models/brain_model/CDP1_brain.py',
          publications: {
            'https://schema.hbp.eu/relativeUrl':
              'sp6/core/publication/v1.0.0/20572429-5c82-41ca-8a9a-67e35d9c1c25b',
            '@id':
              'https://nexus-int.humanbrainproject.org/v0/data/sp6/core/publication/v1.0.0/20572429-5c82-41ca-8a9a-67e35d9c1c25b'
          }
        }
      ],
      total: 2,
      size: 2,
      start: 0
    };
    const result = [
      {
        name: kgBrains.results[0].name,
        description: kgBrains.results[0].description,
        maturity: 'production',
        thumbnail: undefined,
        script: 'script1',
        urls: {
          fileLoader: kgBrains.results[0].file_loader,
          fileUrl: kgBrains.results[0].file_url
        },
        id: kgBrains.results[0].file_loader.split('/').pop(),
        '@id': kgBrains.results[0]['@id']
      },
      {
        name: kgBrains.results[1].name,
        description: kgBrains.results[1].description,
        maturity: 'production',
        thumbnail: undefined,
        script: 'script2',
        urls: {
          fileLoader: kgBrains.results[1].file_loader,
          fileUrl: kgBrains.results[1].file_url
        },
        id: kgBrains.results[1].file_loader.split('/').pop(),
        '@id': kgBrains.results[1]['@id']
      }
    ];
    sinon
      .stub(storageRequestHandler, 'get')
      .onFirstCall()
      .returns({ body: JSON.stringify(kgBrains) })
      .onSecondCall()
      .returns({ body: 'script1' })
      .onThirdCall()
      .returns({ body: 'script2' });

    storageRequestHandler.config.authentication = 'Collab';

    return storageRequestHandler
      .getKnowledgeGraphBrains('query', 'token')
      .should.eventually.deep.equal(result);
  });

  it('should create a KG artifact attachment', () => {
    sinon.stub(fs, 'writeFile').returns(undefined);

    return storageRequestHandler
      .createOrUpdateKgAttachment('file.csv', 'content')
      .should.eventually.equal(undefined);
  });

  it('should get a KG artifact attachment', () => {
    storageRequestHandler
      .getKgAttachment('file.csv')
      .should.eventually.match(/\/KG_DATA_FOLDER\/file\.csv/);
  });

  it('should unzip a .zip file under experiment folder', () => {
    sinon
      .stub(fsStorage, 'unzip')
      .returns(q.resolve([undefined, undefined, undefined]));
    return storageRequestHandler
      .unzip('file.zip', 'binary content', fakeExperiment, fakeUserId)
      .should.eventually.deep.equal([undefined, undefined, undefined]);
  });
});

describe('Request handler (not mocking the mkdir)', () => {
  //createExperiment
  let RewiredDB,
    RewiredDB2,
    RewiredFSStorage,
    fsStorage,
    storageRequestHandler,
    RewiredFSAuthenticator,
    fsAuthenticator;
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24',
    fakeExperiment = '21f0f4e0-9753-42f3-bd29-611d20fc1168';
  //in this test we create a temporary experiments table and then remove
  //it on the fly, because we cannot delete entries from the database
  it(`should successfully create an experiment given a correct token `, () => {
    storageRequestHandler = new StorageRequestHandler(configFile);
    //using the correct authentication DB
    const mockUtils2 = {
      storagePath: path.join(__dirname, 'dbMock')
    };
    RewiredDB2 = rewire('../../storage/FS/DB');
    RewiredDB2.__set__('utils', mockUtils2);
    RewiredFSAuthenticator = rewire('../../storage/FS/Authenticator');
    RewiredFSAuthenticator.__set__('DB', RewiredDB2.default);
    fsAuthenticator = new RewiredFSAuthenticator.Authenticator();
    storageRequestHandler.authenticator = fsAuthenticator;
    //mocking the storage db
    let newPath = path.join(__dirname, 'dbMock2');
    const mockUtils = {
      storagePath: path.join(__dirname, 'dbMock2')
    };
    RewiredDB = rewire('../../storage/FS/DB');
    RewiredDB.__set__('utils', mockUtils);
    RewiredFSStorage = rewire('../../storage/FS/Storage');
    RewiredFSStorage.__set__('DB', RewiredDB.default);
    RewiredFSStorage.__set__('utils', mockUtils);
    fs.existsSync(newPath) || fs.mkdirSync(newPath);
    fsStorage = new RewiredFSStorage.Storage();
    storageRequestHandler.storage = fsStorage;
    storageRequestHandler.getUserIdentifier = () => q.resolve('nrpuser');
    return storageRequestHandler
      .createExperiment(fakeExperiment, fakeToken)
      .then(res => {
        fs.unlinkSync(path.join(__dirname, 'dbMock2/FS_db/experiments'));
        fs.rmdirSync(path.join(__dirname, 'dbMock2/FS_db/'));
        fs.rmdirSync(path.join(__dirname, 'dbMock2/'));
        return res['uuid'].should.contain('-');
      })
      .catch(() => console.log(''));
  });
});
