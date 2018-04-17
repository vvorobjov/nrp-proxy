'use strict';

const fs = require('fs'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path'),
  assert = chai.assert,
  q = require('q'),
  sinon = require('sinon');

chai.use(chaiAsPromised);
chai.should();

const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24',
  fakeUserId = 'nrpuser',
  fakeExperiment = '21f0f4e0-9753-42f3-bd29-611d20fc1168';

describe('BaseStorage', () => {
  const BaseStorage = require('../../storage/BaseStorage.js');
  let baseClassMock;
  //to test the non overidden methods of the BaseAuthenticator we have to provide an empty
  //implementation and instanciate it
  class BaseClassMock extends BaseStorage {
    constructor() {
      super();
    }
  }

  beforeEach(() => {
    baseClassMock = new BaseClassMock();
  });

  it(`should throw a TypeError exception when trying to instanciate the BaseStorage`, () => {
    return expect(() => {
      return new BaseStorage();
    }).to.throw(TypeError, 'BaseStorage is an abstract class');
  });

  //for all the non implemented methods of the base class
  [
    'listFiles',
    'getFile',
    'deleteFile',
    'createOrUpdate',
    'listExperiments',
    'createExperiment',
    'deleteFolder',
    'createFolder',
    'listCustomModels',
    'deleteExperiment',
    'getCustomModel'
  ].forEach(function(item) {
    it('should throw a non implemented method error when trying to use a base class non-overidden function ', () => {
      return expect(baseClassMock[item]).to.throw('not implemented');
    });
  });
});

describe('FSStorage', () => {
  let RewiredDB, RewiredFSStorage, fsStorage;
  const AUTHORIZATION_ERROR = {
    code: 403
  };
  let realUtils = require('../../storage/FS/utils');

  const originalStatSync = fs.statSync;
  const fakeStatSync = file => {
    const stat = originalStatSync(file);
    stat.mtime = new Date('Tue Apr 17 2018 09:38:40 GMT+0200 (CEST)');
    return stat;
  };

  beforeEach(() => {
    const mockUtils = {
      storagePath: path.join(__dirname, 'dbMock'),
      generateUniqueExperimentId: realUtils.generateUniqueExperimentId
    };
    const mockFsExtra = {
      copy: () => q.when('test')
    };
    RewiredDB = rewire('../../storage/FS/DB.js');
    RewiredDB.__set__('utils', mockUtils);
    RewiredFSStorage = rewire('../../storage/FS/Storage.js');
    RewiredFSStorage.__set__('DB', RewiredDB);
    RewiredFSStorage.__set__('utils', mockUtils);
    RewiredFSStorage.__set__('fsExtra', mockFsExtra);
    RewiredFSStorage.__set__('fs.statSync', fakeStatSync);
    var empty = (path, callback) => {
      //empty implementation just to check if fs functions are called
      callback();
    };
    RewiredFSStorage.__set__('fs.mkdir', empty);
    fsStorage = new RewiredFSStorage();
  });

  it(`should return an entry when we check an existing token`, () => {
    return fsStorage
      .userIdHasAccessToPath(fakeUserId, fakeExperiment)
      .should.eventually.contain({ token: fakeUserId });
  });

  //copy experiment
  it(`should copy an experiment correctly`, () => {
    fsStorage.createExperiment = function() {
      return new Promise(function(resolve) {
        resolve('success');
      });
    };

    fsStorage.listFiles = function() {
      return new Promise(function(resolve) {
        resolve([
          {
            uuid: 'file_1',
            name: 'file_1'
          },
          {
            uuid: 'file_2',
            name: 'file_2'
          }
        ]);
      });
    };
    sinon.stub(fsStorage, 'copyFolderContents').returns(q.when());
    return fsStorage
      .copyExperiment('Exp_0', fakeToken, fakeUserId)
      .should.eventually.contain({ clonedExp: 'Exp_0_0' });
  });

  //copy folderContents
  it(`should copy folder contents`, () => {
    return fsStorage
      .copyFolderContents([{ uuid: 'Exp_0', name: 'Exp_0' }], 'test')
      .should.eventually.deep.equal(['test']);
  });

  it(`should throw when we check a non-existing token`, () => {
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

  //deleteExperiment
  it(`should fail to delete an experiment`, () => {
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
    const tmpFilePath = path.join(
      __dirname,
      'dbMock/' + fakeExperiment + '/tmp'
    );
    //create a temp file to be deleted
    return q.denodeify(fs.writeFile)(tmpFilePath, 'fakeContent').then(() => {
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

  it('should remove a folder from the database if the folder does not exist in the FS', () => {
    var mockExpList = [{ experiment: 'nonExisting' }];
    var fsSpy = sinon.spy(fs, 'existsSync');
    fsStorage.removeNonExistingExperiment(mockExpList, fakeUserId);
    return expect(fsSpy.called).to.equal(true);
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
    return fsStorage
      .listExperiments(fakeToken, fakeUserId)
      .should.eventually.contain(expected);
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
    RewiredDB = rewire('../../storage/FS/DB.js');
    RewiredDB.__set__('utils', mockUtils);
    RewiredFSStorage = rewire('../../storage/FS/Storage.js');
    RewiredFSStorage.__set__('DB', RewiredDB);
    RewiredFSStorage.__set__('utils', mockUtils);
    fs.existsSync(newPath) || fs.mkdirSync(newPath);
    fsStorage = new RewiredFSStorage();
    return fsStorage.createExperiment(fakeToken).then(res => {
      fs.unlinkSync(path.join(__dirname, 'dbMock2/FS_db/experiments'));
      fs.rmdirSync(path.join(__dirname, 'dbMock2/FS_db/'));
      fs.rmdirSync(path.join(__dirname, 'dbMock2/'));
      return res['uuid'].should.contain('-');
    });
  });
});

describe('Collab Storage', () => {
  //modules
  const CollabConnector = require('../../storage/Collab/CollabConnector.js'),
    CollabStorage = require('../../storage/Collab/Storage.js');

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
    const CollabConnectorMock = rewire(
      '../../storage/Collab/CollabConnector.js'
    );
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

    return CollabConnectorMock.instance.executeRequest(options, fakeToken)
      .should.be.rejected;
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
      .getCustomModel({ uuid: 'modelPath' }, fakeToken, fakeUserId)
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

  it('should copy an experiment correctly', () => {
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
  const utils = require('../../storage/FS/utils.js');

  it(`should generate a new unique uuid`, () => {
    return expect(
      utils.generateUniqueExperimentId('test', 0, ['test_0', 'test_1'])
    ).to.equal('test_2');
  });
});
