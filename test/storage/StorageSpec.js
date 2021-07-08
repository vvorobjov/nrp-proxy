'use strict';

const fs = require('fs-extra'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  chaiSubset = require('chai-subset'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path'),
  assert = chai.assert,
  q = require('q'),
  sinon = require('sinon'),
  jszip = require('jszip'),
  faketemplateModelAbsPath = path.join(__dirname, 'dbMock', 'TEMPLATE_MODELS'),
  fakecustomModelAbsPath = path.join(__dirname, 'dbMock', 'USER_DATA');

chai.use(chaiAsPromised);
chai.use(chaiSubset);
chai.should();
var collectionMock = sinon.stub();
collectionMock.prototype.insert = sinon.stub().returns(Promise.resolve());
collectionMock.prototype.findOne = sinon
  .stub()
  .returns(Promise.resolve('value'));
collectionMock.prototype.find = sinon.stub().returns(Promise.resolve());
collectionMock.prototype.remove = sinon.stub().returns(Promise.resolve());

const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24',
  fakeUserId = 'nrpuser',
  fakeExperiment = '21f0f4e0-9753-42f3-bd29-611d20fc1168';

describe('FSStorage', () => {
  let RewiredDB, RewiredFSStorage, fsStorage;
  const AUTHORIZATION_ERROR = {
    code: 403
  };
  let { default: realUtils } = require('../../storage/FS/utils');

  const originalStatSync = fs.statSync;
  const fakeStatSync = file => {
    const stat = originalStatSync(file);
    stat.mtime = new Date('Tue Apr 17 2018 09:38:40 GMT+0200 (CEST)');
    return stat;
  };

  const mockFsExtra = {
    copy: () => q.when('test'),
    ensureDir: () => q.resolve(),
    writeFile: () => q.resolve(),
    exists: () => q.resolve(),
    copySync: () => q.resolve('copiedDirectory')
  };

  beforeEach(() => {
    const mockUtils = {
      storagePath: path.join(__dirname, 'dbMock'),
      generateUniqueExperimentId: realUtils.generateUniqueExperimentId,
      getCurrentTimeAndDate: () => '2019-05-03T12:05:17'
    };
    RewiredDB = rewire('../../storage/FS/DB');
    RewiredDB.__set__('utils', mockUtils);
    RewiredDB.__set__('DBCollection', collectionMock);
    RewiredFSStorage = rewire('../../storage/FS/Storage');
    RewiredFSStorage.__set__('DB', RewiredDB.default);
    RewiredFSStorage.__set__('customModelAbsPath', fakecustomModelAbsPath);
    RewiredFSStorage.__set__('templateModelAbsPath', faketemplateModelAbsPath);
    RewiredFSStorage.__set__('utils', mockUtils);
    RewiredFSStorage.__set__('fsExtra', mockFsExtra);
    RewiredFSStorage.__set__('fs.statSync', fakeStatSync);
    var empty = (path, callback) => {
      //empty implementation just to check if fs functions are called
      callback();
    };

    RewiredFSStorage.__set__('fs.mkdir', empty);
    fsStorage = new RewiredFSStorage.Storage();
  });
  /* models inicio */
  it(`should delete a sharing user from a model`, () => {
    var expectedResult = [1, { updatedExisting: true, n: 1 }];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expectedResult));
    return fsStorage
      .deleteSharingUserFromModel('fakeModelType', 'fakeModelID', 'fakeUserID')
      .then(res => expect(res).to.deep.equal(expectedResult));
  });

  it(`should delete a all shared users from a model`, () => {
    var expectedResult = [1, { updatedExisting: true, n: 1 }];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expectedResult));
    return fsStorage
      .deleteSharingUserFromModel('fakeModelType', 'fakeModelID', 'all')
      .then(res => expect(res).to.deep.equal(expectedResult));
  });

  it(`should get list of shared models`, () => {
    var dBResult = [
      {
        name: 'fakeFileName',
        type: 'fakeModelType',
        ownerName: 'userId',
        path: 'folder/model.zip'
      }
    ];

    var expectedResult = [
      {
        name: 'fakeFileName',
        type: 'fakeModelType',
        ownerName: 'userId',
        path: 'folder/model.zip'
      }
    ];

    collectionMock.prototype.find = sinon
      .stub()
      .returns(Promise.resolve(dBResult));
    return fsStorage
      .listSharedModels('fakeModelType', 'fakeModelID')
      .then(res => expect(res).to.deep.equal(expectedResult));
  });

  it(`should get sharing models Option`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve({ sharingOption: 'Private' }));
    return fsStorage
      .getModelSharingMode('fakeModelType', 'fakeModelID')
      .then(res => expect(res).to.deep.equal({ sharingOption: 'Private' }));
  });

  it(`should list shared userss by model`, () => {
    var expectedResult = [1, { updatedExisting: true, n: 1 }];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expectedResult));
    return fsStorage
      .updateSharedModelMode('fakeModelType', 'fakeModelID', 'public')
      .then(res => expect(res).to.deep.equal(expectedResult));
  });

  it(`should list shared userss by Models`, () => {
    var dbresult = {
      sharingUsers: ['user1']
    };
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve(dbresult));
    return fsStorage
      .listSharingUsersbyModel('fakeModelType', 'fakeModelID')
      .then(res => expect(res).to.deep.equal(dbresult.sharingUsers));
  });

  it(`should list all customs models`, () => {
    var dbresult = [
      {
        name: 'modelName',
        ownerName: 'userId',
        path: 'folder/model.zip',
        type: 'robot',
        sharingOption: 'Private',
        isCustom: true
      }
    ];
    var expectedResult = [
      {
        name: 'modelName',
        ownerName: 'userId',
        path: 'folder/model.zip',
        type: 'robot',
        isShared: false,
        isCustom: true
      }
    ];
    collectionMock.prototype.find = sinon
      .stub()
      .returns(Promise.resolve(dbresult));
    return fsStorage
      .listAllModels('fakeModelType', 'fakeUserId')
      .then(res => expect(res).to.deep.equal(expectedResult));
  });

  it(`should list sharing users by model type`, () => {
    var expectedResult = [1, { updatedExisting: true, n: 1 }];

    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expectedResult));

    collectionMock.prototype.find = sinon
      .stub()
      .returns(Promise.resolve({ _id: 'fakeId' }));
    return fsStorage
      .addUsertoSharingUserListinModel('fakeModelType', 'fakeUserId')
      .then(res => expect(res).to.deep.equal(expectedResult));
  });

  /* models fin */
  it(`should get shared Experiments Option`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve({ data: 'Private' }));
    return fsStorage
      .getExperimentSharingMode('expId')
      .then(res => expect(res).to.deep.equal({ data: 'Private' }));
  });

  it(`should list sharing users by experiment`, () => {
    var expectedResult = [1, { updatedExisting: true, n: 1 }];
    collectionMock.prototype.update = sinon
      .stub()
      .returns(Promise.resolve(expectedResult));
    return fsStorage
      .updateSharedExperimentMode('expId', 'public')
      .then(res => expect(res).to.deep.equal(expectedResult));
  });

  it(`should list shared userss by experiments`, () => {
    var dbresult = {
      token: 'user0',
      experiment: 'benchmark_p3dx_0',
      _id: 5,
      shared_users: ['user1', 'user2'],
      shared_option: 'Shared'
    };
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve(dbresult));
    return fsStorage
      .listSharingUsersbyExperiment('expId')
      .then(res => expect(res).to.deep.equal(dbresult.shared_users));
  });

  it(`should list experiments shared by users`, () => {
    var expectedResult = { uuid: 'exp0', name: 'exp0' };
    collectionMock.prototype.find = sinon.stub().returns(
      Promise.resolve([
        {
          experiment: 'exp0',
          shared_option: 'Shared',
          shared_users: ['userId']
        }
      ])
    );
    return fsStorage
      .listExperimentsSharedByUsers('userId')
      .then(res => expect(res[0]).to.deep.equal(expectedResult));
  });

  it(`should get the model Path of an specific model`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve({ path: 'husky_model', type: 'robots' }));
    return fsStorage
      .getModelPath('robots', 'hbp_clearpath_robotics_husky_a200')
      .then(res => res.should.equal('husky_model'));
  });

  it(`should get the full Path of a specific model`, () => {
    collectionMock.prototype.findOne = sinon.stub().returns(
      Promise.resolve({
        path: 'husky_model',
        type: 'robots',
        isCustom: false
      })
    );
    return fsStorage
      .getModelFullPath('robots', 'hbp_clearpath_robotics_husky_a200')
      .then(res =>
        res.should.equal(
          path.join(faketemplateModelAbsPath, 'robots/husky_model')
        )
      );
  });

  it(`should get a custom model`, () => {
    const mockUtils = { getZipOfFolder: () => new jszip() };
    RewiredFSStorage.__set__('utils', mockUtils);
    sinon.stub(jszip.prototype, 'generateAsync').returns(q.when('zip'));
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve({ type: 'robots', path: 'husky_model' }));
    return fsStorage
      .getModelZip('robots', 'hbp_clearpath_robotics_husky_a200', 'admin')
      .then(res => expect(res).should.not.be.empty);
  });

  it(`should list all custom models`, () => {
    collectionMock.prototype.find = sinon.stub().returns(
      Promise.resolve([
        {
          name: 'name',
          path: 'foldername',
          ownerName: 'userId',
          type: 'robot'
        }
      ])
    );

    return fsStorage.listModelsbyType('customFolder').then(res =>
      res.should.deep.equal([
        {
          name: 'name',
          path: 'foldername',
          ownerName: 'userId',
          type: 'robot'
        }
      ])
    );
  });
  it(`should throw when we try to add an user when the exp does not exist`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve(null));
    return assert.isRejected(
      fsStorage.addUsertoSharingUserListinModel(
        'modelType',
        'modelName',
        'userName'
      )
    );
  });

  it(`should throw when we try to add an user when the exp does not exist`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve(null));
    return assert.isRejected(
      fsStorage.addUsertoSharingUserListinExperiment('newExperiment', 'userid')
    );
  });

  it(`should fail to list all custom models`, () => {
    collectionMock.prototype.find = sinon.stub().returns(Promise.reject());
    return fsStorage
      .listModelsbyType('customFolder')
      .then(res => res.should.deep.equal([]));
  });

  it(`should get a list custom model by user`, () => {
    const expected = {
      name: 'modelName',
      path: 'foldername',
      ownerId: 'userId',
      type: 'robots'
    };
    collectionMock.prototype.find = sinon
      .stub()
      .returns(Promise.resolve([expected]));
    return fsStorage
      .listUserModelsbyType('robots', fakeToken, fakeUserId)
      .then(res => {
        expect(res[0].name).to.be.equal('modelName');
      });
  });

  it(`should have an error when here is not model `, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve(null));
    return fsStorage
      .getModelZip('robots', 'hbp_clearpath_robotics_husky_a200', 'admin')
      .should.be.eventually.rejectedWith(
        'The model: hbp_clearpath_robotics_husky_a200 does not exist in the Models database.'
      );
  });

  it(`should have return empty if there is an error in list models`, () => {
    collectionMock.prototype.find = sinon.stub().returns(Promise.reject(null));
    return fsStorage
      .listUserModelsbyType(
        { uuid: 'robots/husky_model.zip' },
        fakeToken,
        'admin'
      )
      .should.eventually.deep.equal([]);
  });

  it('should create custom model correctly', () => {
    let fakeModel = {
      ownerName: 'ownerName',
      name: 'ownerName',
      type: 'type',
      path: 'path'
    };
    const fakeZipContent = {
      files: {
        'dir1/': 'content',
        'dir1/script.py': 'content'
      },
      file: function() {
        return { async: () => q.when('content') };
      }
    };
    sinon.stub(jszip, 'loadAsync').returns(q.resolve(fakeZipContent));
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve(null));

    return fsStorage
      .createCustomModel(fakeModel, 'zip')
      .then(res => expect(res).should.be.resolved);
  });

  it(`should return an entry when we check an existing token`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve({ token: fakeUserId }));
    return fsStorage
      .userIdHasAccessToPath(fakeUserId, fakeExperiment)
      .should.eventually.contain({ token: fakeUserId });
  });

  //copy experiment
  it(`should copy an experiment correctly`, () => {
    fsStorage.createExperiment = () => q.resolve('success');
    fsStorage.listExperiments = () =>
      q.resolve([{ uuid: 'uuid', name: 'name1' }]);
    fsStorage.listFiles = () =>
      q.resolve([
        {
          uuid: 'file_1',
          name: 'file_1'
        },
        {
          uuid: 'file_2',
          name: 'file_2'
        }
      ]);

    sinon.stub(fsStorage, 'copyFolderContents').returns(q.when());
    fsStorage.getFile = () => q.resolve({ body: 'expConfBody' });
    sinon.stub(fsStorage, 'decorateExpConfigurationWithAttribute').returns({});
    fsStorage.createOrUpdate = () => q.resolve();
    return fsStorage
      .copyExperiment('Exp_0', fakeToken, fakeUserId)
      .should.eventually.contain({ clonedExp: 'Exp_0_0' });
  });

  //copy folderContents
  it(`should copy folder contents`, () => {
    return fsStorage
      .copyFolderContents('Exp_0', 'Exp_0_0')
      .should.eventually.deep.equal('copiedDirectory');
  });

  //copy folderContents
  it(`should decorate an .exc with a new attribute`, () => {
    const excBufferWithPrefix = `<ns1:ExD xmlns:ns1="http://schemas.humanbrainproject.eu/SP10/2014/ExDConfig"></ns1:ExD>`;
    let result = `<ns1:ExD 
      xmlns:ns1="http://schemas.humanbrainproject.eu/SP10/2014/ExDConfig">
      <ns1:cloneDate>fakeDate</ns1:cloneDate>
    </ns1:ExD>`;
    const excBufferWithoutPrefix = `<ExD 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
    xmlns="http://schemas.humanbrainproject.eu/SP10/2014/ExDConfig" xsi:schemaLocation="http://schemas.humanbrainproject.eu/SP10/2014/ExDConfig ../ExDConfFile.xsd">
   </ExD>`;

    let decoratedExpConf = fsStorage.decorateExpConfigurationWithAttribute(
      'cloneDate',
      'fakeDate',
      excBufferWithPrefix
    );
    // for the expectation we remove the whitespaces and the newlines as they confuse the comparison
    expect(result.replace(/\n$/, '').replace(/ /g, '')).to.deep.equal(
      decoratedExpConf.replace(/\n$/, '').replace(/ /g, '')
    );
    decoratedExpConf = fsStorage.decorateExpConfigurationWithAttribute(
      'cloneDate',
      'fakeDate',
      excBufferWithoutPrefix
    );
    result = `<ExD 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
    xmlns="http://schemas.humanbrainproject.eu/SP10/2014/ExDConfig" xsi:schemaLocation="http://schemas.humanbrainproject.eu/SP10/2014/ExDConfig ../ExDConfFile.xsd">
    <cloneDate>fakeDate</cloneDate>
    </ExD>`;
    expect(result.replace(/\n$/, '').replace(/ /g, '')).to.deep.equal(
      decoratedExpConf.replace(/\n$/, '').replace(/ /g, '')
    );
  });

  it(`should throw when we check a non-existing token`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve(null));
    return assert.isRejected(
      fsStorage.userIdHasAccessToPath('non-existing-token', fakeExperiment),
      AUTHORIZATION_ERROR
    );
  });

  //calculateFilePath
  it(`should calculate the file path given an existing folder and file name `, () => {
    const expectedPath = path.join(__dirname, '/dbMock/folder1/fakeFile');
    return fsStorage
      .calculateFilePath('', 'folder1/fakeFile')
      .should.equal(expectedPath);
  });

  it(`should throw an exception when trying to calculate a path
  given a file the user does not have access to`, () => {
    return assert.isRejected(
      fsStorage.calculateFilePath('', '../NonExistingFile'),
      AUTHORIZATION_ERROR
    );
  });

  //listFiles
  it(`should list all the files contained in a certain experiment`, async () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(
        Promise.resolve({ token: fakeUserId, experiment: fakeExperiment })
      );
    const files = await fsStorage.listFiles(
      fakeExperiment,
      fakeToken,
      fakeUserId
    );
    return expect(files[0]).to.containSubset({
      name: 'fakeFile',
      uuid: '21f0f4e0-9753-42f3-bd29-611d20fc1168/fakeFile',
      size: 11,
      type: 'file'
    });
  });

  it(`should throw authorization exception when calling the listFiles function with wrong parameters`, () => {
    return assert.isRejected(
      fsStorage.listFiles('fakeToken', fakeExperiment),
      AUTHORIZATION_ERROR
    );
  });

  //getFile
  it(`should return the contents of a file given a correct experiment and token`, () => {
    return fsStorage
      .getFile(
        fakeExperiment + '/fakeFile',
        fakeExperiment,
        fakeToken,
        fakeUserId
      )
      .then(val => {
        var stringContents = String.fromCharCode.apply(
          null,
          new Uint8Array(val.body)
        );
        return expect(stringContents).to.contain('fakeContent');
      });
  });
  it(`should return the contents of a file given a correct experiment and token when byname is true`, () => {
    return fsStorage
      .getFile('fakeFile', 'fakeExperiment', fakeToken, fakeUserId, true)
      .then(val => {
        var stringContents = String.fromCharCode.apply(
          null,
          new Uint8Array(val.body)
        );
        return expect(stringContents).to.contain('fakeContent');
      });
  });

  //deleteExperiment
  it(`should fail to delete an experiment`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve(null));
    return fsStorage
      .deleteExperiment('fakeExp', 'fakeExp', fakeToken, fakeUserId)
      .catch(val => expect(val).to.deep.equal({ code: 403 }));
  });

  it(`should delete an experiment`, () => {
    sinon.stub(fsStorage, 'deleteFolder').returns(
      new Promise(function(resolve) {
        resolve('resultMock');
      })
    );

    return fsStorage
      .deleteExperiment('fakeExp', 'fakeExp', fakeToken, fakeUserId)
      .then(val => expect(val).to.be.undefined);
  });

  it(`should throw an authorization exception when trying to read a file from a non existing folder`, () => {
    return assert.isRejected(
      fsStorage.getFile('wrongFileName', fakeExperiment, fakeToken),
      AUTHORIZATION_ERROR
    );
  });

  //deleteFile
  it(`should succesfully delete a file given the correct data`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(
        Promise.resolve({ token: fakeUserId, experiment: fakeExperiment })
      );
    const tmpFilePath = path.join(
      __dirname,
      'dbMock/' + fakeExperiment + '/tmp'
    );
    //create a temp file to be deleted
    return q
      .denodeify(fs.writeFile)(tmpFilePath, 'fakeContent')
      .then(() => {
        //delete the temp file
        return fsStorage
          .deleteFile(
            fakeExperiment + '/tmp',
            fakeExperiment,
            fakeToken,
            fakeUserId
          )
          .then(() => {
            //check if the file was indeed deleted
            return expect(
              fsStorage.listFiles(fakeExperiment, fakeToken, fakeUserId)
            )
              .to.eventually.be.an('array')
              .that.not.include('tmp');
          });
      });
  });

  //createOrUpdate
  it(`should create a new file when we call the createOrUpdateFunction`, () => {
    //create a tmp file
    return fsStorage
      .createOrUpdate(
        'tmp',
        'emptyContent',
        'text/plain',
        fakeExperiment,
        fakeToken,
        fakeUserId
      )
      .then(() => {
        return fsStorage
          .listFiles(fakeExperiment, fakeToken, fakeUserId)
          .then(val => {
            var folderContents = val;
            //clean up the tmp file
            fsStorage.deleteFile(
              fakeExperiment + '/tmp',
              fakeExperiment,
              fakeToken,
              fakeUserId
            );

            return expect(
              folderContents[folderContents.length - 1]
            ).to.containSubset({
              name: 'tmp',
              uuid: '21f0f4e0-9753-42f3-bd29-611d20fc1168/tmp',
              size: 12,
              type: 'file',
              modifiedOn: new Date('Tue Apr 17 2018 09:38:40 GMT+0200 (CEST)')
            });
          });
      });
  });

  //listExperiments
  it(`should list all the experiments the current token provides`, () => {
    const expected = {
      uuid: fakeExperiment,
      name: fakeExperiment
    };
    collectionMock.prototype.find = sinon.stub().returns(
      Promise.resolve([
        {
          uuid: fakeExperiment,
          name: fakeExperiment,
          experiment: fakeExperiment
        }
      ])
    );
    collectionMock.prototype.remove = sinon.stub().returns(Promise.resolve());
    return fsStorage
      .listExperiments(fakeToken, fakeUserId)
      .should.eventually.contain(expected);
  });

  it(`should return reject if there is an error`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.reject('someError'));
    return fsStorage.deleteFile(
      fakeExperiment,
      fakeExperiment,
      fakeToken,
      fakeUserId
    ).should.be.eventually.rejected;
  });

  it(`should not create an experiment when it already exists`, () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve('value'));
    return fsStorage.createExperiment(fakeExperiment, fakeToken, fakeUserId)
      .should.be.eventually.rejected;
  });
  it(`should succesfully delete a file given when byname is true`, () => {
    var unlinkMock = sinon.stub().returns(Promise.resolve('deleted'));
    RewiredFSStorage.__set__('fs.unlink', unlinkMock);
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(
        Promise.resolve({ token: fakeUserId, experiment: fakeExperiment })
      );
    fsStorage
      .deleteFile(
        'fakeExperiment' + '/tmp',
        fakeExperiment,
        fakeToken,
        fakeUserId,
        true
      )
      .should.eventually.contain('deleted');
  });
  //createUniqueId
  it(`should create a unique id for a given experiment folder name`, () => {
    collectionMock.prototype.find = sinon.stub().returns(
      Promise.resolve([
        {
          uuid: fakeExperiment,
          name: fakeExperiment,
          experiment: 'husky_0'
        }
      ])
    );
    const expected = 'husky_1';
    return fsStorage
      .createUniqueExperimentId(fakeToken, fakeUserId, 'husky')
      .should.eventually.contain(expected);
  });

  //getStoragePath
  it(`should create a unique id for a given experiment folder name`, () => {
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock') };
    RewiredDB.__set__('utils', mockUtils);
    expect(fsStorage.getStoragePath()).to.contain('dbMock');
  });

  //insertExperimentInDB
  it(`should insert an experiment in the database`, () => {
    collectionMock.prototype.insert = sinon
      .stub()
      .returns(Promise.resolve('inserted'));
    return fsStorage
      .insertExperimentInDB(fakeUserId, 'p3dx_6')
      .should.eventually.equal('inserted');
  });

  //removeExperiments
  it(`should remove experiments from the database`, () => {
    const exp1 = {
      uuid: fakeExperiment,
      name: fakeExperiment,
      experiment: 'husky_0'
    };
    const exp2 = {
      uuid: fakeExperiment,
      name: fakeExperiment,
      experiment: 'husky_1'
    };
    const experimentsToBeRemoved = [exp1, exp2];
    collectionMock.prototype.remove = sinon
      .stub()
      .returns(Promise.resolve('removed'));
    return fsStorage
      .removeExperiments(experimentsToBeRemoved)
      .should.eventually.deep.equal(['removed', 'removed']);
  });

  //addNonRegisteredExperiments
  it(`should add non-registered experiments to the database`, () => {
    const exp1 = {
      experiment: 'husky_0'
    };
    const exp2 = {
      experiment: 'husky_1'
    };
    const experimentsToBeAdded = [exp1, exp2];
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(Promise.resolve(null));
    return fsStorage
      .addNonRegisteredExperiments(fakeUserId, experimentsToBeAdded)
      .should.eventually.deep.equal([
        { experiment: 'husky_0' },
        { experiment: 'husky_1' }
      ]);
  });

  //scanStorage
  it(`should scan the user storage, register new experiment folders if needed, or remove database entries corresponding to deleted ones`, () => {
    sinon
      .stub(fsStorage, 'addNonRegisteredExperiments')
      .returns(Promise.resolve(['experiment1', 'experiment2']));
    sinon
      .stub(fsStorage, 'removeExperiments')
      .withArgs(['husky_sbc_1', 'lauron_5']);
    collectionMock.prototype.find = sinon.stub().returns(
      Promise.resolve([
        {
          experiment: 'husky_sbc_1'
        },
        {
          experiment: 'lauron_5'
        }
      ])
    );
    return fsStorage.scanStorage(fakeUserId).then(r => {
      expect(fsStorage.removeExperiments.called).to.be.true;
      expect(r).deep.equal({
        deletedFolders: ['husky_sbc_1', 'lauron_5'],
        addedFolders: ['experiment1', 'experiment2']
      });
    });
  });

  it('should unzip file under experiment after having checked user permissions', () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(
        Promise.resolve({ token: fakeUserId, experiment: fakeExperiment })
      );
    jszip.loadAsync.restore();
    sinon.stub(jszip, 'loadAsync').returns('zipFileContent');
    sinon
      .stub(fsStorage, 'extractZip')
      .returns(q.resolve(['undefined', 'undefined', 'undefined']));
    return expect(
      fsStorage.unzip(
        'filename.zip',
        'binary content',
        fakeExperiment,
        fakeUserId
      )
    ).to.eventually.deep.equal(['undefined', 'undefined', 'undefined']);
  });

  after(() => {
    jszip.loadAsync.restore();
  });
});

describe('FS Storage (not mocking the mkdir)', () => {
  //createExperiment
  let RewiredDB, RewiredFSStorage, fsStorage;
  //in this test we create a temporary experiments table and then remove
  //it on the fly, because we cannot delete entries from the database

  it(`should successfully create an experiment given a correct token `, () => {
    let newPath = path.join(__dirname, 'dbMock2');
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock2') };
    RewiredDB = rewire('../../storage/FS/DB');
    RewiredDB.__set__('utils', mockUtils);
    RewiredFSStorage = rewire('../../storage/FS/Storage');
    RewiredFSStorage.__set__('DB', RewiredDB.default);
    RewiredFSStorage.__set__('utils', mockUtils);
    fs.existsSync(newPath) || fs.mkdirSync(newPath);
    fsStorage = new RewiredFSStorage.Storage();
    return fsStorage.createExperiment(fakeToken).then(res => {
      fs.unlinkSync(path.join(__dirname, 'dbMock2/FS_db/experiments'));
      fs.rmdirSync(path.join(__dirname, 'dbMock2/FS_db/'));
      fs.rmdirSync(path.join(__dirname, 'dbMock2/'));
      return res['uuid'].should.contain('-');
    });
  });
});

describe('FS Storage: extracting a zip experiment to the storage (no mock of fs)', () => {
  let RewiredFSStorage, fsStorage;
  before(function() {
    const mockUtils = {
      storagePath: path.join(__dirname, '../data/experiments')
    };
    RewiredFSStorage = rewire('../../storage/FS/Storage');
    RewiredFSStorage.__set__('utils', mockUtils);
    fsStorage = new RewiredFSStorage.Storage();
  });

  //extractZip
  it(`should extract the zip experiment into the destination folder`, () => {
    return q
      .denodeify(fs.readFile)(
        path.join(__dirname, '../data/experiments/test_experiment_folder.zip')
      )
      .catch(err => console.log(err))
      .then(zipContent => jszip.loadAsync(zipContent))
      .then(zipContent =>
        fsStorage
          .extractZip(zipContent, 'template_husky_5')
          .then(() => {
            const folderpath = path.join(
              fsStorage.getStoragePath(),
              'template_husky_5'
            );
            let files = fs.readdirSync(folderpath);
            // Removes extracted folder
            files.forEach(filename =>
              fs.unlinkSync(path.join(folderpath, filename))
            );
            fs.rmdirSync(folderpath);
            return files;
          })
          .should.eventually.include(
            'brainvisualizer.json',
            'all_neurons_spike_monitor.py',
            'ExDTemplateHusky.uis',
            'ExDTemplateHusky.jpg',
            'ExDTemplateHusky.ini',
            'ExDTemplateHusky.exc',
            'turn_around.py',
            'grab_image.py',
            'template_husky.bibi'
          )
      );
  });
});

describe('Collab Storage', () => {
  //modules
  const {
      default: CollabConnector
    } = require('../../storage/Collab/CollabConnector'),
    { Storage: CollabStorage } = require('../../storage/Collab/Storage');

  //we need to mock all the http responses, thus we use a mocking framework called nock
  var nock = require('nock');

  //instances
  let collabConnector, collabStorage;

  //helper variables
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24',
    fakeUserId = fakeToken,
    fakeExperiment = '21f0f4e0-9753-42f3-bd29-611d20fc1168',
    baseCollabURL = 'https://services.humanbrainproject.eu/storage/v1/api';

  beforeEach(() => {
    collabStorage = new CollabStorage({
      collabId: 'fakeId',
      storage: 'Collab',
      authentication: 'Collab'
    });
  });

  //Collab connector
  it('should succesfully get the correct request timeout', () => {
    return CollabConnector.REQUEST_TIMEOUT.should.equal(30 * 1000);
  });

  it('should succesfully get the correct collab api url', () => {
    return CollabConnector.COLLAB_API_URL.should.equal(baseCollabURL);
  });

  it('should successfully post a new file', () => {
    nock('https://services.humanbrainproject.eu')
      .post('/storage/v1/api/file/')
      .reply(200, 'success');

    return CollabConnector.instance
      .createFile('fakeToken', 'fakeFolder', 'fakeName', 'text/plain')
      .should.eventually.equal('success');
  });

  it('should retrive teh context collab id', () => {
    const response = { collab: { id: 'collabId' } };

    nock('https://services.humanbrainproject.eu')
      .get('/collab/v0/collab/context/fakeContextId/')
      .reply(200, response);

    return CollabConnector.instance
      .getContextIdCollab('fakeToken', 'fakeContextId')
      .should.eventually.equal('collabId');
  });

  it('should fail to post a new file', () => {
    nock('https://services.humanbrainproject.eu')
      .post('/storage/v1/api/file/')
      .replyWithError({ message: 'fail', code: 404 });
    collabConnector = CollabConnector.instance;
    return collabConnector.createFile(
      'fakeToken',
      'fakeFolder',
      'fakeName',
      'text/plain'
    ).should.be.rejected;
  });

  it('should throw when we have a response with a wrong status code', () => {
    const resp = { statusCode: 404 };
    const CollabConnectorMock = rewire('../../storage/Collab/CollabConnector');
    CollabConnectorMock.__set__('request', () => {
      return q.resolve(resp);
    });
    const options = {
      method: 'GET',
      uri:
        'https://services.humanbrainproject.eu/storage/v1/api/folder/21f0f4e0-9753-42f3-bd29-611d20fc1168/children/',
      resolveWithFullResponse: true,
      timeout: 60000,
      headers: { Authorization: 'Bearer a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24' }
    };

    return CollabConnectorMock.default.instance.executeRequest(
      options,
      fakeToken
    ).should.be.rejected;
  });

  //Collab storage

  //get files
  it('should get the files under a specific experiment', () => {
    //mock of the collab response
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/folder/' + fakeExperiment + '/children/')
      .replyWithFile(200, path.join(__dirname, 'replies/contents.json'));

    const expected = {
      uuid: '53ab549f-030f-4d0f-ac82-eac66a181092',
      name: 'arm_reinforcement_learning.py',
      parent: 'fbdaba55-2012-40d9-b466-017cff025c36',
      contentType: 'text/x-python',
      modifiedOn: '2017-02-10T15:20:22.493599Z',
      type: 'file'
    };

    return expect(collabStorage.listFiles(fakeExperiment, fakeToken))
      .to.eventually.be.an('array')
      .that.include(expected);
  });

  //get file
  it('should get a file under a specific experiment ', () => {
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/fakeFile/content/')
      .replyWithFile(200, path.join(__dirname, 'replies/file.json'));
    const expected = {
      fakeContent: 'This is a really really fake content'
    };

    return collabStorage
      .getFile('fakeFile', fakeExperiment, fakeToken)
      .then(res => {
        expect(JSON.parse(res.body)).to.contain(expected);
      });
  });

  //get file by name
  it('should get a file by name under a specific experiment ', () => {
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/folder/' + fakeExperiment + '/children/')
      .replyWithFile(200, path.join(__dirname, 'replies/contents.json'));

    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/2a47824e-6c7a-47ab-b228-d61e1439d062/content/')
      .replyWithFile(200, path.join(__dirname, 'replies/file.json'));
    const expected = {
      fakeContent: 'This is a really really fake content'
    };

    return collabStorage
      .getFile(
        'braitenberg_mouse.py',
        fakeExperiment,
        fakeToken,
        fakeUserId,
        true
      )
      .then(res => {
        expect(JSON.parse(res.body)).to.contain(expected);
      });
  });

  //delete file
  it('should delete a file under a specific experiment', () => {
    nock('https://services.humanbrainproject.eu')
      .delete('/storage/v1/api/file/fakeFile/')
      .reply(200, 'Success');

    return collabStorage
      .deleteFile('fakeFile', fakeExperiment, fakeToken)
      .should.eventually.equal('Success');
  });

  //create folder
  it('should create a folder', () => {
    nock('https://services.humanbrainproject.eu')
      .post('/storage/v1/api/folder/')
      .reply(200, 'Success');

    return collabStorage
      .createFolder('fakeFile', fakeExperiment, fakeToken)
      .should.eventually.equal('Success');
  });

  //create or update file
  it('should create or update a file under a specific experiment ', () => {
    const fileUuid = '53ab549f-030f-4d0f-ac82-eac66a181092';
    nock('https://services.humanbrainproject.eu')
      .post('/storage/v1/api/file/')
      .reply(200, 'Success');
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/folder/' + fakeExperiment + '/children/')
      .replyWithFile(200, path.join(__dirname, 'replies/contents.json'));
    nock('https://services.humanbrainproject.eu')
      .post('/storage/v1/api/file/' + fileUuid + '/content/upload/')
      .reply(200, 'success');

    return collabStorage
      .createOrUpdate(
        'arm_reinforcement_learning.py',
        'fakeContent',
        'text/plain',
        fakeExperiment,
        fakeToken
      )
      .should.eventually.contain({
        uuid: '53ab549f-030f-4d0f-ac82-eac66a181092'
      });
  });

  //list experiments
  it('should list all experiments available to the user', () => {
    const fileUuid = '53ab549f-030f-4d0f-ac82-eac66a181092',
      response = JSON.stringify({
        uuid: '53ab549f-030f-4d0f-ac82-eac66a181092',
        entity_type: 'file',
        name: 'arm_reinforcement_learning.py',
        description: '',
        content_type: 'text/x-python',
        parent: 'fbdaba55-2012-40d9-b466-017cff025c36',
        created_by: '302416',
        created_on: '2017-02-10T15:20:16.514456Z',
        modified_by: '302416',
        modified_on: '2017-02-10T15:20:22.493599Z'
      });
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/entity/?path=%2FfakeId')
      .reply(200, response);
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/project/' + fileUuid + '/children/')
      .replyWithFile(200, path.join(__dirname, 'replies/contents.json'));
    const expected = {
      uuid: '53ab549f-030f-4d0f-ac82-eac66a181092',
      name: 'arm_reinforcement_learning.py',
      parent: 'fbdaba55-2012-40d9-b466-017cff025c36'
    };

    return expect(collabStorage.listExperiments(fakeToken, fakeUserId))
      .to.eventually.be.an('array')
      .that.include(expected);
  });

  //list experiments by contextId
  it('should list all experiments available to the user by contextId', () => {
    const fileUuid = '53ab549f-030f-4d0f-ac82-eac66a181092',
      response = JSON.stringify({
        uuid: '53ab549f-030f-4d0f-ac82-eac66a181092',
        entity_type: 'file',
        name: 'arm_reinforcement_learning.py',
        description: '',
        content_type: 'text/x-python',
        parent: 'fbdaba55-2012-40d9-b466-017cff025c36',
        created_by: '302416',
        created_on: '2017-02-10T15:20:16.514456Z',
        modified_by: '302416',
        modified_on: '2017-02-10T15:20:22.493599Z'
      });
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/entity/?path=%2FfakeId')
      .reply(200, response);
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/project/' + fileUuid + '/children/')
      .replyWithFile(200, path.join(__dirname, 'replies/contents.json'));
    const expected = {
      uuid: '53ab549f-030f-4d0f-ac82-eac66a181092',
      name: 'arm_reinforcement_learning.py',
      parent: 'fbdaba55-2012-40d9-b466-017cff025c36'
    };

    nock('https://services.humanbrainproject.eu')
      .get('/collab/v0/collab/context/contextid/')
      .reply(200, '{ "collab": { "id":"fakeId"}}');

    return expect(collabStorage.listExperiments(fakeToken, 'contextid'))
      .to.eventually.be.an('array')
      .that.include(expected);
  });

  it('should throw when doing a dummy request', () => {
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/fakeFile/content/')
      .reply(404, 'error!');

    return expect(collabStorage.getFile('fakeFile', fakeExperiment, fakeToken))
      .to.eventually.be.rejected;
  });

  //create experiment
  it('should create a new experiment ', () => {
    nock('https://services.humanbrainproject.eu')
      .post('/storage/v1/api/folder/')
      .reply(200, 'Success');

    return collabStorage
      .createExperiment(fakeExperiment, fakeToken)
      .should.eventually.equal('Success');
  });

  it('should redirect if there is an authentication error (403)', () => {
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/fakeFile/content/')
      .reply(403, 'error!');

    return expect(collabStorage.getFile('fakeFile', fakeExperiment, fakeToken))
      .to.eventually.be.rejected;
  });

  it('should return the correct robot from the robots user folder', () => {
    const foldersMock = [
      {
        name: 'robots',
        uuid: 'testUUID'
      },
      {
        name: 'environments',
        uuid: 'testUUID2'
      },
      {
        name: 'Exp_0',
        uuid: 'Exp_0'
      }
    ];

    const contentsMock = [
      {
        name: 'robot1',
        uuid: 'fakeUUID1'
      }
    ];
    sinon.stub(CollabStorage.prototype, 'listExperiments').returns(
      new Promise(function(resolve) {
        resolve(foldersMock);
      })
    );
    sinon.stub(CollabConnector.prototype, 'folderContent').returns(
      new Promise(function(resolve) {
        resolve(contentsMock);
      })
    );

    var storage = new CollabStorage();
    return storage
      .listCustomModels('robots', fakeToken, fakeUserId, 'contextId')
      .then(res => {
        res[0].should.deep.equal({ uuid: 'fakeUUID1', fileName: 'robot1' });
      });
  });

  it('should delete an folder correctly', () => {
    sinon.stub(CollabConnector.prototype, 'deleteEntity').returns(
      new Promise(function(resolve) {
        resolve('resultMock');
      })
    );

    var storage = new CollabStorage();
    return storage
      .deleteFolder('robots', fakeExperiment, fakeToken, fakeUserId, false)
      .then(res => {
        return expect(res).to.equal('resultMock');
      });
  });

  it('should delete an experiment correctly', () => {
    var storage = new CollabStorage();
    return storage
      .deleteExperiment(fakeExperiment, fakeExperiment, fakeToken, fakeUserId)
      .then(res => {
        return expect(res).to.equal('resultMock');
      });
  });

  it('should get custom model correctly', () => {
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/modelPath/content/')
      .reply(200, { msg: 'Success!' });
    return collabStorage
      .getModelZip({ uuid: 'modelPath' }, fakeToken, fakeUserId)
      .then(res => JSON.parse(res).should.deep.equal({ msg: 'Success!' }));
  });

  it('should create custom model correctly', () => {
    nock('https://services.humanbrainproject.eu')
      .post('/storage/v1/api/file/undefined/content/upload/')
      .reply(200, { msg: 'Success!' });
    return collabStorage
      .createCustomModel(
        'robots',
        'data',
        fakeUserId,
        'test.zip',
        fakeToken,
        'contextId'
      )
      .then(res => res.should.deep.equal({ uuid: undefined }));
  });

  it('should copy an experiment correctly2', () => {
    const contentsMock = [
      {
        name: 'robot1',
        uuid: 'fakeUUID1',
        contentType: 'test'
      }
    ];

    sinon.stub(CollabStorage.prototype, 'createExperiment').returns(
      new Promise(function(resolve) {
        resolve('test');
      })
    );

    sinon.stub(CollabStorage.prototype, 'listFiles').returns(
      new Promise(function(resolve) {
        resolve(contentsMock);
      })
    );

    sinon.stub(CollabStorage.prototype, 'getFile').returns(
      new Promise(function(resolve) {
        resolve({ body: 'fake_contents' });
      })
    );

    sinon.stub(CollabStorage.prototype, 'createOrUpdate').returns(
      new Promise(function(resolve) {
        resolve({});
      })
    );

    var storage = new CollabStorage();
    return storage
      .copyExperiment('Exp_0', fakeToken, fakeUserId, 'contextId')
      .then(res => {
        return expect(res.originalExp).to.equal('Exp_0');
      });
  });
});

describe('Utils', () => {
  const { default: utils } = require('../../storage/FS/utils');

  it(`should generate a new unique uuid`, () => {
    return expect(
      utils.generateUniqueExperimentId('test', 0, ['test_0', 'test_1'])
    ).to.equal('test_2');
  });

  it('should return a JSZip instance filled with contents of dir', () => {
    const allPaths = [
      path.join(
        __dirname,
        '../data/experiments/experiment1/ExDTemplateHusky.3ds'
      ),
      path.join(
        __dirname,
        '../data/experiments/experiment1/ExDTemplateHusky.exc'
      ),
      path.join(
        __dirname,
        '../data/experiments/experiment1/braitenberg_husky_linear_twist.py'
      ),
      path.join(
        __dirname,
        '../data/experiments/experiment1/template_husky.bibi'
      ),
      path.join(__dirname, '../data/experiments/experiment1/test.png')
    ];

    // force lstat. Don't know why isDirectory doesn't work properly during tests
    sinon.stub(fs, 'lstatSync').returns({
      isDirectory: () => false,
      isSymbolicLink: () => false
    });

    return expect(
      utils.getZipOfFolder(
        path.join(__dirname, '../data/experiments/experiment1')
      )
    ).to.not.be.empty;
  });
});
