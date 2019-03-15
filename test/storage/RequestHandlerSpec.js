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
  chaiSubset = require('chai-subset');
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

StorageRequestHandlerRewire.__set__('TemplateExperimentCloner', fakeCloner);
StorageRequestHandlerRewire.__set__('NewExperimentCloner', fakeCloner);

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
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock') };
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
    RewiredFSStorage.__set__('fs.readdirSync', fakeReadDirSync);
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
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(
        Promise.resolve({ token: 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24' })
      );

    return storageRequestHandler
      .authenticate('nrpuser', 'password')
      .should.eventually.equal(fakeToken);
  });

  it('should detect user that has not accepted gdpr', () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve('userId'));

    return storageRequestHandler
      .getGDPRStatus('nrpuser')
      .should.eventually.deep.equal({ gdpr: false });
  });

  it('should set user accepted gdpr', () => {
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
    var expectedResult = ['nrpuser', 'admin'];
    collectionMock.prototype.find = sinon
      .stub()
      .returns(Promise.resolve([{ user: 'nrpuser' }, { user: 'admin' }]));
    return storageRequestHandler.getUsersList(fakeToken).then(userList => {
      expect(userList).to.deep.equal(expectedResult);
    });
  });

  it(`should create a new shared Experiment when we call the addExperimentSharedUserByUser`, () => {
    var expectedResult = [{ uuid: fakeExperiment, name: fakeExperiment }];
    var adminToken = '1d3409e4-8a4e-409d-b6c7-58dacc4b833e';
    collectionMock.prototype.find = sinon
      .stub()
      .returns(Promise.resolve([{ experiment: fakeExperiment }]));

    return storageRequestHandler
      .addUsertoSharedUserListinExperiment(
        fakeExperiment,
        'admin',
        fakeToken,
        'contextId'
      )
      .then(() =>
        storageRequestHandler
          .listExperimentsSharedByUser(adminToken)
          .then(folderContents => {
            expect(folderContents).to.deep.equal(expectedResult);
          })
      );
  });

  it(`should succesfully update the shared option of the experiment`, () => {
    var expected = [1, { updatedExisting: true, n: 1 }];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expected));
    return storageRequestHandler
      .updateSharedExperimentMode('fakeExperiment', 'public')
      .then(res => {
        expect(res).to.deep.equal(expected);
      });
  });

  it(`should succesfully delete a shared user`, () => {
    var expected = [1, { updatedExisting: true, n: 1 }];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expected));
    return storageRequestHandler
      .deleteSharedUserFromExperiment('fakeExperiment', 'userId')
      .then(res => expect(res).to.deep.equal(expected));
  });

  it(`should succesfully get the shared option of the experiment`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve('Private'));
    return storageRequestHandler
      .getExperimentSharedMode('fakeExperiment', 'userId')
      .then(res => expect(res).to.deep.equal('Private'));
  });

  it(`should succesfully get the list of the shared users by experiment`, () => {
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
      .listSharedUsersbyExperiment('fakeExperiment', 'token')
      .then(res => expect(res).to.deep.equal(dbresult.shared_users));
  });

  it(`should succesfully list all customs models`, () => {
    var expectedResult = { uuid: 'file0', fileName: 'file0', userId: 'token0' };
    collectionMock.prototype.find = sinon
      .stub()
      .returns(Promise.resolve([{ fileName: 'file0', token: 'token0' }]));

    return storageRequestHandler
      .listAllCustomModels('customFolder', 'token', 'userId', 'contextId')
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
    const robot = '/robots/husky.zip';
    storageRequestHandler.getUserIdentifier = () => q.resolve('test 0');
    storageRequestHandler.authenticator.checkToken = () => q.resolve('nrpuser');

    collectionMock.prototype.findOne = sinon.stub().returns(q.resolve(null));

    return storageRequestHandler
      .deleteCustomModel(robot, 'userId')
      .catch(res =>
        expect(res).to.deep.equal(
          `The model: ${robot} does not exist in the Models database.`
        )
      );
  });

  it(`should fail to delete a custom model which is not in the FS`, () => {
    const robot = '/robots/husky.zip';
    RewiredFSStorage.__set__('fs.unlink', () => q.reject());
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(
        Promise.resolve({ fileName: robot, token: 'token', type: 'robot' })
      );

    return storageRequestHandler
      .deleteCustomModel(robot, 'userId')
      .catch(res =>
        expect(res).to.deep.equal(
          `Could not find the model ${robot} to remove in the user storage.`
        )
      );
  });

  it(`should delete a custom model from the FS even when it fails to remove it from the DB`, () => {
    const robot = '/robots/husky.zip';
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(
        Promise.resolve({ fileName: robot, token: 'token', type: 'robot' })
      );

    collectionMock.prototype.remove = sinon
      .stub()
      .returns(Promise.resolve(null));

    return storageRequestHandler
      .deleteCustomModel(robot, 'userId')
      .catch(res =>
        expect(res).to.deep.equal(
          `Could not delete the model ${robot} from the Models database.`
        )
      );
  });

  it(`should succesfully delete a custom model`, () => {
    const robot = '/robots/husky.zip';
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(
        Promise.resolve({ fileName: robot, token: 'token', type: 'robot' })
      );
    collectionMock.prototype.remove = sinon
      .stub()
      .returns(Promise.resolve({ value: 1 }));
    return storageRequestHandler
      .deleteCustomModel(robot, 'userId')
      .then(res =>
        expect(res).to.deep.equal(
          `Succesfully deleted model ${robot} from the user storage.`
        )
      );
  });

  it(`should fail to delete a custom model which is not in the storage`, () => {
    const robot = '/robots/husky.zip';
    return storageRequestHandler
      .deleteCustomModel(robot, 'userId')
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
    collectionMock.prototype.find = sinon
      .stub()
      .returns(Promise.resolve([{ experiment: fakeExperiment }]));

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

  // listCustomModels success
  it(`should correctly return the user custom files`, () => {
    storageRequestHandler.customModelService.getZipModelMetaData = function() {
      return q.when(config);
    };
    storageRequestHandler.getUserIdentifier = () => q.resolve('test 0');
    storageRequestHandler.authenticator.checkToken = () => q.resolve('nrpuser');

    storageRequestHandler.storage.listCustomModels = function() {
      return q.when([
        { uuid: 'robots/husky_model.zip', fileName: 'robots/husky_model.zip' }
      ]);
    };
    storageRequestHandler.storage.getCustomModel = function() {
      return q.when([{ path: 'robots/husky_model.zip', data: [] }]);
    };

    return storageRequestHandler
      .listCustomModels('robots', fakeToken)
      .should.eventually.deep.include(config);
  });

  // getUserInfo success
  it(`should successfully return the user info`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve({ user: 'nrpuser' }));

    return storageRequestHandler
      .getUserInfo('nrpuser', fakeToken)
      .should.eventually.deep.equal({ id: 'nrpuser', displayName: 'nrpuser' });
  });

  // getUserGroups success
  it(`should successfully return the group info`, () => {
    return storageRequestHandler.getUserGroups(fakeToken).then(resp => {
      resp[0].should.deep.equal({ name: 'hbp-sp10-user-edit-rights' });
    });
  });

  // createZip success
  it(`should successfully create a custom model`, () => {
    storageRequestHandler.storage.createCustomModel = function() {
      return q.when('test 1');
    };
    return storageRequestHandler
      .createCustomModel('robots', fakeToken, 'test.zip', null)
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
    StorageRequestHandlerRewire.__set__('customModelService', fakeCustomModels);
    var storageRequestHandler2 = new StorageRequestHandler(configFile);
    storageRequestHandler2.createCustomModel = function() {
      return 'success';
    };
    return storageRequestHandler2
      .createZip(fakeToken, 'robots', 'test.zip', 'fakeZip', null)
      .should.eventually.equal('success');
  });

  it('should get the getCustomModelConfig service object correctly', async () => {
    var storageRequestHandler2 = new StorageRequestHandler(configFile);
    storageRequestHandler2.getCustomModel = function() {
      return q.when([{ path: 'robots/husky_model.zip', data: [] }]);
    };

    return storageRequestHandler2
      .getCustomModelConfig({ uuid: 'robots/husky_model.zip' }, fakeToken)
      .should.eventually.deep.include(config);
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
    const mockUtils2 = { storagePath: path.join(__dirname, 'dbMock') };
    RewiredDB2 = rewire('../../storage/FS/DB');
    RewiredDB2.__set__('utils', mockUtils2);
    RewiredFSAuthenticator = rewire('../../storage/FS/Authenticator');
    RewiredFSAuthenticator.__set__('DB', RewiredDB2.default);
    fsAuthenticator = new RewiredFSAuthenticator.Authenticator();
    storageRequestHandler.authenticator = fsAuthenticator;
    //mocking the storage db
    let newPath = path.join(__dirname, 'dbMock2');
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock2') };
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
