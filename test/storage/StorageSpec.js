'use strict';

const fs = require('fs-extra');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiSubset = require('chai-subset');
const rewire = require('rewire');
const expect = chai.expect;
const path = require('path');
const assert = chai.assert;
const q = require('q');
const sinon = require('sinon');
const jszip = require('jszip');

const faketemplateModelAbsPath = path.join(
  __dirname,
  'dbMock',
  'TEMPLATE_MODELS'
);
const fakecustomModelAbsPath = path.join(__dirname, 'dbMock', 'USER_DATA');

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

    return fsStorage.createCustomModel(fakeModel, 'zip').then(res => {
      jszip.loadAsync.restore();
      expect(res).should.be.resolved;
    });
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
    sinon.stub(fsStorage, 'updateAttribute').returns({});
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
  it(`should calculate the file path given an existing folder and file name `, async () => {
    const expectedPath = path.join(__dirname, '/dbMock/folder1/fakeFile');
    const testFilepath = await fsStorage.calculateFilePath(
      '',
      'folder1/fakeFile'
    );
    return testFilepath.should.equal(expectedPath);
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

  it('should run scanExperiments', () => {
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
    return fsStorage.scanExperiments().then(r => {
      expect(r).deep.equal(['husky_sbc_1', 'lauron_5']);
    });
  });

  it('should unzip file under experiment after having checked user permissions', () => {
    collectionMock.prototype.findOne = sinon
      .stub()
      .returns(
        Promise.resolve({ token: fakeUserId, experiment: fakeExperiment })
      );

    // clean old mock if present
    // if ('restore' in jszip.loadAsync && typeof jszip.loadAsync['restore'] === 'function'){
    //   jszip.loadAsync.restore();
    // }
    sinon.stub(jszip, 'loadAsync').returns('zipFileContent');
    sinon
      .stub(fsStorage, 'extractZip')
      .returns(q.resolve(['undefined', 'undefined', 'undefined']));
    return expect(
      fsStorage
        .unzip('filename.zip', 'binary content', fakeExperiment, fakeUserId)
        .then(res => {
          jszip.loadAsync.restore();
          return res;
        })
    ).to.eventually.deep.equal(['undefined', 'undefined', 'undefined']);
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
      return res.uuid.should.contain('-');
    });
  });
});

describe('FS Storage: extracting a zip experiment to the storage (no mock of fs)', () => {
  let RewiredFSStorage, fsStorage;
  beforeEach(function() {
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

  let confFilePath = path.join(__dirname, '../utils/config.json'),
    confFilePath2 = path.join(__dirname, '../utils/config_2.json'),
    configurationManagerRewire = rewire('../../utils/configurationManager');
  configurationManagerRewire.__set__('CONFIG_FILE', confFilePath);
  CollabConnector.instance.initConfig(confFilePath);

  //we need to mock all the http responses, thus we use a mocking framework called nock
  var nock = require('nock');
  const fakeDownloadURL = 'https://fake/download/url';
  //instances
  let collabConnector, collabStorage;

  //helper variables
  const defaultConfigName = 'simulation_config.json';
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24',
    fakeUserId = fakeToken,
    fakeExperiment = '21f0f4e0-9753-42f3-bd29-611d20fc1168';

  beforeEach(() => {
    collabStorage = new CollabStorage({
      collabId: 'fakeId',
      storage: 'Collab',
      authentication: 'Collab'
    });
    CollabConnector.instance.initConfig(confFilePath);
    //collabConnector = new CollabConnector();
  });

  //Collab connector
  it('should succesfully get the correct request timeout', () => {
    return CollabConnector.REQUEST_TIMEOUT.should.equal(30 * 1000);
  });

  it('upload file should succeed with the file uuid', () => {
    const fakeUuid = 'fakeFolder/fakeName/';
    const fakeUrl = 'https://fake.url.upload/test/';
    nock(CollabConnector.URL_BUCKET_API)
      .put('/' + fakeUuid)
      .reply(200, JSON.stringify({ url: fakeUrl }));

    nock('https://fake.url.upload')
      .log(console.log)
      .put('/test/')
      .reply(200, 'success');

    return CollabConnector.instance
      .uploadContent('fakeToken', fakeUuid, '')
      .should.eventually.equal(fakeUuid);
  });

  it('should copy a folder with succes', () => {
    nock(CollabConnector.URL_BUCKET_API)
      .put(
        '/fakeFolder/oldExperiment%2F/copy?to=fakeFolder&name=newExperiment%2F'
      )
      .reply(200, 'success');

    return CollabConnector.instance
      .copyFolder(
        'fakeToken',
        'fakeFolder',
        'newExperiment',
        'fakeFolder/oldExperiment'
      )
      .then(response => response.body)
      .should.eventually.equal('success');
  });

  it('should retrieve the context collab id', () => {
    const response = { collab: { id: 'collabId' } };

    nock('https://services.humanbrainproject.eu')
      .get('/collab/v0/collab/context/fakeContextId/')
      .reply(200, response);

    return CollabConnector.instance
      .getContextIdCollab('fakeToken', 'fakeContextId')
      .should.eventually.equal('collabId');
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

    return CollabConnectorMock.default.instance.requestHTTPS(options, fakeToken)
      .should.be.rejected;
  });

  //Collab storage

  //unimplemented functions

  it('getStoragePath should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.getStoragePath()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('listSharedModels should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.listSharedModels()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('listUserModelsbyType should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.listUserModelsbyType()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('isDirectory should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.isDirectory()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('getExperimentSharingMode should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.getExperimentSharingMode()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('updateSharedExperimentMode should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.updateSharedExperimentMode()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('listSharingUsersbyExperiment should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.listSharingUsersbyExperiment()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('listExperimentsSharedByUsers should not be implemented', () => {
    expect(
      CollabStorage.prototype.listExperimentsSharedByUsers()
    ).to.deep.equal([]);
  });

  it('deleteSharingUserFromExperiment should not be implemented', () => {
    try {
      expect(
        CollabStorage.prototype.deleteSharingUserFromExperiment()
      ).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('listAllModels should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.listAllModels()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('addUsertoSharingUserListinModel should not be implemented', () => {
    try {
      expect(
        CollabStorage.prototype.addUsertoSharingUserListinModel()
      ).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('listSharingUsersbyModel should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.listSharingUsersbyModel()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('updateSharedModelMode should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.updateSharedModelMode()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('getModelSharingMode should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.getModelSharingMode()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('deleteSharingUserFromModel should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.deleteSharingUserFromModel()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('addUsertoSharingUserListinExperiment should not be implemented', () => {
    try {
      expect(
        CollabStorage.prototype.addUsertoSharingUserListinExperiment()
      ).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('copyFolderContents should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.copyFolderContents()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('extractZip should not be implemented', async () => {
    collabStorage
      .extractZip('zip', 'fakeDestFolderName')
      .should.eventually.equal('not implemented');
  });

  it('createUniqueExperimentId should not be implemented', async () => {
    collabStorage
      .createUniqueExperimentId()
      .should.eventually.deep.equal('not implemented');
  });

  it('insertExperimentInDB should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.insertExperimentInDB()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('createOrUpdateKgAttachment should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.createOrUpdateKgAttachment()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('getKgAttachment should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.getKgAttachment()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('unzip should not be implemented', () => {
    try {
      expect(CollabStorage.prototype.unzip()).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  //get files
  it('should decorate an experiment configuration with an attribute', async () => {
    var storage = new CollabStorage();
    //mock of the collab response
    const attribute = 'attribute';
    const value = 'value';
    var experimentConfiguration = {
      experiments: [
        {
          type: 'folder',
          path: 'Experiment'
        }
      ]
    };
    const decoratedExperimentConfiguration = storage.decorateExpConfigurationWithAttribute(
      attribute,
      value,
      JSON.stringify(experimentConfiguration)
    );
    return JSON.parse(decoratedExperimentConfiguration).attribute.should.equal(
      value
    );
  });

  it('should copy a folder with succes', async () => {
    var storage = new CollabStorage();
    nock(CollabConnector.URL_BUCKET_API)
      .put('/fakeFolder/Experiment%2F/copy?to=fakeFolder&name=Experiment_0%2F')
      .reply(200, 'success');

    nock(CollabConnector.URL_BUCKET_API)
      .get('/fakeFolder/nrp-experiments.json?inline=false&redirect=false')
      .reply(200, {
        url: fakeDownloadURL
      });

    nock(fakeDownloadURL)
      .get('')
      .reply(200, {
        experiments: [
          {
            type: 'folder',
            path: 'Experiment'
          }
        ]
      });
    await storage
      .copyExperiment('fakeFolder/Experiment', 'fakeToken', 'fakeContextId')
      .should.eventually.to.deep.equal({
        clonedExp: 'fakeFolder/Experiment_0',
        originalExp: 'fakeFolder/Experiment'
      });
  });

  it('should rename an experiment successfully', async () => {
    const fakeExperiment = 'fakeFolder/fakeExperiment';
    const fakeDownloadURL = 'https://fakedownload.url';

    nock(CollabConnector.URL_BUCKET_API)
      .get('/fakeFolder?limit=9999&delimiter=%2F&prefix=fakeExperiment/')
      .replyWithFile(200, path.join(__dirname, 'replies/foldercontents.json'), {
        'content-type': 'application/json'
      });

    nock(CollabConnector.URL_BUCKET_API)
      .patch('/' + fakeExperiment + '/')
      .reply(200);

    nock(CollabConnector.URL_BUCKET_API)
      .get(
        `/${fakeExperiment}/${defaultConfigName}?inline=false&redirect=false`
      )
      .reply(200, { url: fakeDownloadURL });

    nock(fakeDownloadURL)
      .get()
      .replyWithFile(
        200,
        path.join(__dirname, `replies/${defaultConfigName}`)
      );

    collabStorage
      .renameExperiment(
        fakeExperiment,
        'fakeNewName',
        'fakeToken',
        'fakeUserID'
      )
      .should.eventually.equal('success');
  });

  it('should scan the collab storage successfully', async () => {
    const fakeBucket = 'fakeBucket';
    const fakeCorruptedExperiment = `${fakeBucket}/corruptedExperiment`;
         
    sinon.stub(CollabStorage.prototype, 'getNrpCollabsViaTag').returns(
      new Promise(function(resolve) {
        resolve([fakeBucket]);
      })
    );

    sinon.stub(CollabStorage.prototype, 'getBucketNrpExperimentsConfig').returns(
      new Promise(function(resolve) {
        resolve({ experiments : [
        {
          type: 'folder',
          path: 'corruptedExperiment'
        }
      ]})})
    );

    nock(CollabConnector.URL_BUCKET_API)
    .get(
      `/${fakeBucket}?limit=9999&delimiter=%2F`
    )
    .replyWithFile(200, path.join(__dirname, 'replies/scanstoragecontent.json'), {'content-type' : 'application/json'});

    sinon.stub(CollabStorage.prototype, 'getFile')
    .withArgs(defaultConfigName, `${fakeBucket}/corrupted_folder`,'fakeToken')
    .returns(
      new Promise(function(resolve) {
        fs.readFile(path.join(__dirname, 'replies/file.json'), 'utf8')
        .then(content => resolve({body : content}))}))
    .withArgs(defaultConfigName, fakeCorruptedExperiment, 'fakeToken')
    .returns(
      new Promise(function(resolve) {
        fs.readFile(path.join(__dirname, 'replies/file.json'), 'utf8')
        .then(content => resolve({body : content}))}))
    .withArgs(defaultConfigName, `${fakeBucket}/unregistered_experiment`, 'fakeToken')
    .returns(
      new Promise(function(resolve) {
        fs.readFile(path.join(__dirname, `replies/${defaultConfigName}`), 'utf8')
        .then(content => resolve({body : content}))}));

    sinon.stub(CollabStorage.prototype, 'createOrUpdate').returns(
      new Promise(function(resolve) {resolve("success")})
    );

    // test that scanStorage remove folder that are not experiments
    nock(CollabConnector.URL_BUCKET_API)
      .delete(`/${fakeBucket}/corrupted_folder/`)
      .reply(200, { msg: 'Success!' });

    // test that scanStorage remove corrupted experiments
    nock(CollabConnector.URL_BUCKET_API)
      .delete(`/${fakeCorruptedExperiment}/`)
      .reply(200, { msg: 'Success!' });

    // test that scanStorage remove files unrelated to experiments
    nock(CollabConnector.URL_BUCKET_API)
      .delete(`/${fakeBucket}/unregistered_file`)
      .reply(200, { msg: 'Success!' });

    await collabStorage
      .scanStorage('fakeUserId','fakeToken'
      )
      .should.eventually.equal('success');

      CollabStorage.prototype.createOrUpdate.restore();
      CollabStorage.prototype.getFile.restore();
  });
  //get files
  it.skip('should get the files under a specific experiment', async () => {
    //mock of the collab response
    nock(CollabConnector.URL_BUCKET_API)
      .get('/' + fakeExperiment + '?limit=9999&delimiter=%2F')
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

  it('should return empty urls if config.json is incorrect', () => {
    CollabConnector.instance.initConfig(confFilePath2);
    CollabConnector.URL_BUCKET_API.should.equal('');
    CollabConnector.SEARCH_TAG_URL.should.equal('');
  });

  //get file
  it('should get a file under a specific experiment', () => {
    const fakeDownloadURL = 'https://fake/download/url';
    nock(CollabConnector.URL_BUCKET_API)
      .get('/fakeFile?inline=false&redirect=false')
      .reply(200, { url: fakeDownloadURL });
    nock(fakeDownloadURL)
      .get('')
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
  it.skip('should get a file by name under a specific experiment ', () => {
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
  it('should delete a file under a specific experiment', async () => {
    nock(CollabConnector.URL_BUCKET_API)
      .delete('/fakeFolder/fakeExperiment/fakeFile')
      .reply(200, 'Success');
    return await collabStorage
      .deleteFile('fakeFile', 'fakeFolder/fakeExperiment', fakeToken)
      .then(response => response.body)
      .should.eventually.equal('Success');
  });

  //create folder
  it('should create a folder', () => {
    try {
      expect(
        collabStorage.createFolder('fakeFile', fakeExperiment, fakeToken)
      ).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('should retrieve the context collab id', () => {
    const response = { collab: { id: 'collabId' } };

    nock('https://services.humanbrainproject.eu')
      .get('/collab/v0/collab/context/fakeContextId/')
      .reply(200, response);

    return collabStorage
      .getCollabId('fakeToken', 'fakeContextId')
      .should.eventually.equal('collabId');
  });

  //create or update file
  it.skip('should create or update a file under a specific experiment ', () => {
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
  it.skip('should list all experiments available to the user', () => {
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
  it.skip('should list all experiments available to the user by contextId', () => {
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

  it.skip('should throw when doing a dummy request', () => {
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/fakeFile/content/')
      .reply(404, 'error!');

    return expect(collabStorage.getFile('fakeFile', fakeExperiment, fakeToken))
      .to.eventually.be.rejected;
  });

  //create experiment
  it('should create a new experiment ', () => {
    try {
      expect(
        collabStorage.createExperiment('fakeFile', fakeExperiment, fakeToken)
      ).to.throw();
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it.skip('should redirect if there is an authentication error (403)', () => {
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/fakeFile/content/')
      .reply(403, 'error!');

    return expect(collabStorage.getFile('fakeFile', fakeExperiment, fakeToken))
      .to.eventually.be.rejected;
  });

  it.skip('should return the correct robot from the robots user folder', () => {
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

  it('should delete a folder correctly', () => {
    const fakeFolder = 'fakeFolder';
    nock(CollabConnector.URL_BUCKET_API)
      .log(console.log)
      .delete(`/${fakeFolder}/`)
      .reply(200, 'Success');

    var storage = new CollabStorage();
    return storage
      .deleteFolder(fakeFolder, fakeExperiment, fakeToken, fakeUserId, false)
      .then(response => response.body)
      .should.eventually.equal('Success');
  });

  it('should delete an experiment correctly', () => {
    var storage = new CollabStorage();
    const fakeExperiment = 'fakeFolder/fakeExperiment';
    const fakeDownloadURL = 'https://fakeDownload.url';
    nock(CollabConnector.URL_BUCKET_API)
      .delete(`/${fakeExperiment}/`)
      .reply(200, { msg: 'Success!' });

    nock(CollabConnector.URL_BUCKET_API)
      .get('/fakeFolder/nrp-experiments.json?inline=false&redirect=false')
      .reply(200, { url: fakeDownloadURL });

    nock(fakeDownloadURL)
      .get('/')
      .replyWithFile(
        200,
        path.join(__dirname, 'replies/nrp-experiments.json'),
        { 'content-type': 'application/json' }
      );

    sinon.stub(CollabStorage.prototype, 'createOrUpdate').returns(
      new Promise(function(resolve) {
        resolve();
      })
    );
    return storage
      .deleteExperiment(fakeExperiment, fakeExperiment, fakeToken, fakeUserId)
      .then(res => {
        return expect(res).to.equal(fakeExperiment + ' deleted');
      });
  });

  it.skip('should get custom model correctly', () => {
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/modelPath/content/')
      .reply(200, { msg: 'Success!' });
    return collabStorage
      .getModelZip({ uuid: 'modelPath' }, fakeToken, fakeUserId)
      .then(res => JSON.parse(res).should.deep.equal({ msg: 'Success!' }));
  });

  it.skip('should create custom model correctly', () => {
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

  it.skip('should copy an experiment correctly2', () => {
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

  it(`should check if the file is an image`, () => {
    utils.IMG_EXT.forEach(ext => {
      expect(utils.isImage('image' + ext)).to.equal(true);
    });
    expect(utils.isImage('image.doc')).to.equal(false);
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
