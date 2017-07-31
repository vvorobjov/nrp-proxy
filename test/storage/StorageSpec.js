'use strict';

const fs = require('fs'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  expect = chai.expect,
  should = chai.should(),
  path = require('path'),
  assert = chai.assert,
  sinon = require('sinon'),
  q = require('q');
chai.use(chaiAsPromised);

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
    return expect(() => { return new BaseStorage(); }).to.throw(TypeError, 'BaseStorage is an abstract class');
  });

  //for all the non implemented methods of the base class
  ['listFiles', 'getFile', 'deleteFile', 'createOrUpdate', 'listExperiments', 'createExperiment'].forEach(function(item) {
    it('should throw a non implemented method error when trying to use a base class non-overidden function ', () => {
      return expect(baseClassMock[item]).to.throw('not implemented');
    });
  });
});

describe('FSStorage', () => {
  let RewiredDB, RewiredFSStorage, testDB, fsStorage;
  const AUTHORIZATION_ERROR = {
    code: 403
  };
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24',
    fakeExperiment = '21f0f4e0-9753-42f3-bd29-611d20fc1168';

  beforeEach(() => {
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock') };
    RewiredDB = rewire('../../storage/FS/DB.js');
    RewiredDB.__set__('utils', mockUtils);
    RewiredFSStorage = rewire('../../storage/FS/Storage.js');
    RewiredFSStorage.__set__('DB', RewiredDB);
    RewiredFSStorage.__set__('utils', mockUtils);
    var empty = (path, callback) => {
      //empty implementation just to check if fs functions are called
      callback();
    };
    RewiredFSStorage.__set__('fs.mkdir', empty);
    testDB = new RewiredDB();
    fsStorage = new RewiredFSStorage();
  });

  //tokenHasAccessToExperiment
  it(`should return an entry when we check an existing token`, () => {
    return fsStorage.tokenHasAccessToExperiment(fakeToken, fakeExperiment)
      .should.eventually.contain({ token: fakeToken });
  });

  it(`should throw when we check a non-existing token`, () => {
    return assert.isRejected(fsStorage.
      tokenHasAccessToExperiment('non-existing-token', fakeExperiment),
      AUTHORIZATION_ERROR);
  });

  //calculateFilePath
  it(`should calculate the file path given an existing folder and file name `, () => {
    const expectedPath = path.join(__dirname, '/dbMock/folder1/fakeFile');
    return fsStorage.calculateFilePath('folder1', 'fakeFile').should.equal(expectedPath);
  });

  it(`should throw an exception when trying to calculate a path
  given a file the user does not have access to`, () => {
      return assert.isRejected(fsStorage.calculateFilePath('nonExistingfFolder', '../NonExistingFile'),
        AUTHORIZATION_ERROR);
    });

  //listFiles
  it(`should list all the files contained in a certain experiment`, () => {
    return expect(fsStorage.listFiles(fakeExperiment, fakeToken))
      .to.eventually.be.an('array').that.include({
        uuid: 'fakeFile',
        name: 'fakeFile'
      });
  });

  it(`should throw authorization exception when calling the listFiles function with wrong parameters`, () => {
    return assert.isRejected(fsStorage.listFiles('fakeToken', fakeExperiment),
      AUTHORIZATION_ERROR);
  });

  //getFile
  it(`should return the contents of a file given a correct experiment and token`, () => {
    return fsStorage.getFile('fakeFile',
      fakeExperiment,
      fakeToken).then((val) => {
        var stringContents = String.fromCharCode.apply(null, new Uint8Array(val.body));
        return expect(stringContents).to.contain('fakeContent');
      });
  });

  it(`should throw an authorization exception when trying to read a file from a non existing folder`, () => {
    return assert.isRejected(fsStorage.getFile('wrongFileName',
      fakeExperiment,
      fakeToken),
      AUTHORIZATION_ERROR);
  });

  //deleteFile
  it(`should succesfully delete a file given the correct data`, () => {
    const tmpFilePath = path.join(__dirname, 'dbMock/' + fakeExperiment + '/tmp');
    //create a temp file to be deleted
    return q.denodeify(fs.writeFile)(tmpFilePath, 'fakeContent').then((val) => {
      //delete the temp file
      return fsStorage.deleteFile('tmp',
        fakeExperiment,
        fakeToken).then((val) => {
          //check if the file was indeed deleted
          return expect(fsStorage.listFiles(fakeExperiment, fakeToken))
            .to.eventually.be.an('array').that.not.include('tmp');
        });
    });
  });

  //createOrUpdate
  it(`should create a new file when we call the createOrUpdateFunction`, () => {
    //create a tmp file
    return fsStorage.createOrUpdate('tmp', 'emptyContent', 'text/plain', fakeExperiment, fakeToken)
      .then(() => {
        return fsStorage.listFiles(fakeExperiment, fakeToken).then((val) => {
          var folderContents = val;
          //clean up the tmp file
          fsStorage.deleteFile('tmp', fakeExperiment, fakeToken);
          return expect(folderContents).to.include({
            uuid: 'tmp',
            name: 'tmp'
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
    return fsStorage.listExperiments(fakeToken).
      should.eventually.contain(expected);
  });

});

describe('FS Storage (not mocking the mkdir)', () => {
  //createExperiment
  let RewiredDB, RewiredFSStorage, testDB, fsStorage;
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24';
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
    testDB = new RewiredDB();
    fsStorage = new RewiredFSStorage();
    return fsStorage.createExperiment(fakeToken).then((res) => {
      fs.unlinkSync(path.join(__dirname, 'dbMock2/FS_db/experiments'));
      fs.rmdirSync(path.join(__dirname, 'dbMock2/FS_db/'));
      fs.rmdirSync(path.join(__dirname, 'dbMock2/'));
      return res.should.contain('-');
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
    fakeExperiment = '21f0f4e0-9753-42f3-bd29-611d20fc1168',
    baseCollabURL = 'https://services.humanbrainproject.eu/storage/v1/api';

  beforeEach(() => {
    collabStorage = new CollabStorage({ collabId: 'fakeId' });
  });

  //Collab connector
  it('should succesfully get the correct request timeout', () => {
    return CollabConnector.REQUEST_TIMEOUT.should.equal(60 * 1000);
  });

  it('should succesfully get the correct collab api url', () => {
    return CollabConnector.COLLAB_API_URL.should.equal(baseCollabURL);
  });

  it('should successfully post a new file', () => {
    const response = nock('https://services.humanbrainproject.eu')
      .post('/storage/v1/api/file/')
      .reply(200, 'success');
    collabConnector = CollabConnector.instance;
    return collabConnector.createFile('fakeToken', 'fakeFolder', 'fakeName', 'text/plain')
      .should.eventually.equal('success');
  });

  it('should fail to post a new file', () => {
    const response = nock('https://services.humanbrainproject.eu')
      .post('/storage/v1/api/file/')
      .replyWithError({ 'message': 'fail', 'code': 404 });
    collabConnector = CollabConnector.instance;
    return collabConnector.createFile('fakeToken', 'fakeFolder', 'fakeName', 'text/plain')
      .should.be.rejected;

  });

  it('should throw when we have a response with a wrong status code', () => {
    const resp = { statusCode: 404 };
    const CollabConnectorMock = rewire('../../storage/Collab/CollabConnector.js');
    CollabConnectorMock.__set__('request', (options) => {
      return q.resolve(resp);
    });
    const options = {
      method: 'GET',
      uri: 'https://services.humanbrainproject.eu/storage/v1/api/folder/21f0f4e0-9753-42f3-bd29-611d20fc1168/children/',
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
    const response = nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/folder/' + fakeExperiment + '/children/')
      .replyWithFile(200, path.join(__dirname, 'replies/contents.json')),

      expected = {
        uuid: '53ab549f-030f-4d0f-ac82-eac66a181092',
        name: 'arm_reinforcement_learning.py',
        parent: 'fbdaba55-2012-40d9-b466-017cff025c36'
      };

    return expect(collabStorage.listFiles(fakeExperiment, fakeToken))
      .to.eventually.be.an('array').that.include(expected);
  });

  //get file
  it('should get a file under a specific experiment ', () => {
    const response = nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/fakeFile/content/')
      .replyWithFile(200, path.join(__dirname, 'replies/file.json')),
      expected = {
        fakeContent: 'This is a really really fake content'
      };

    return collabStorage.getFile('fakeFile', fakeExperiment, fakeToken).then((res) => {
      expect(JSON.parse(res.body)).to.contain(expected);
    });
  });

  //get file by name
  it('should get a file by name under a specific experiment ', () => {
    nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/folder/' + fakeExperiment + '/children/')
      .replyWithFile(200, path.join(__dirname, 'replies/contents.json'));

    const response = nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/2a47824e-6c7a-47ab-b228-d61e1439d062/content/')
      .replyWithFile(200, path.join(__dirname, 'replies/file.json')),
      expected = {
        fakeContent: 'This is a really really fake content'
      };

    return collabStorage.getFile('braitenberg_mouse.py', fakeExperiment, fakeToken, true).then((res) => {
      expect(JSON.parse(res.body)).to.contain(expected);
    });
  });

  //delete file
  it('should delete a file under a specific experiment ', () => {
    const response = nock('https://services.humanbrainproject.eu')
      .delete('/storage/v1/api/file/fakeFile/')
      .reply(200, 'Success');

    return collabStorage.deleteFile('fakeFile', fakeExperiment, fakeToken)
      .should.eventually.equal('Success');
  });

  //create or update file
  it('should create or update a file under a specific experiment ', () => {
    const
      fileUuid = '53ab549f-030f-4d0f-ac82-eac66a181092',

      fakePost = nock('https://services.humanbrainproject.eu')
        .post('/storage/v1/api/file/')
        .reply(200, 'Success'),

      fakeGet = nock('https://services.humanbrainproject.eu')
        .get('/storage/v1/api/folder/' + fakeExperiment + '/children/')
        .replyWithFile(200, path.join(__dirname, 'replies/contents.json')),

      fakeSecondPost = nock('https://services.humanbrainproject.eu')
        .post('/storage/v1/api/file/' + fileUuid + '/content/upload/')
        .reply(200, 'success');

    return collabStorage.createOrUpdate('arm_reinforcement_learning.py', 'fakeContent', 'text/plain', fakeExperiment, fakeToken)
      .should.eventually.contain({
        uuid: '53ab549f-030f-4d0f-ac82-eac66a181092'
      });
  });

  //list experiments
  it('should list all experiments available to the user', () => {
    const
      fileUuid = '53ab549f-030f-4d0f-ac82-eac66a181092',

      response = JSON.stringify({
        'uuid': '53ab549f-030f-4d0f-ac82-eac66a181092',
        'entity_type': 'file',
        'name': 'arm_reinforcement_learning.py',
        'description': '',
        'content_type': 'text/x-python',
        'parent': 'fbdaba55-2012-40d9-b466-017cff025c36',
        'created_by': '302416',
        'created_on': '2017-02-10T15:20:16.514456Z',
        'modified_by': '302416',
        'modified_on': '2017-02-10T15:20:22.493599Z'
      }),

      fakeGet = nock('https://services.humanbrainproject.eu')
        .get('/storage/v1/api/entity/?path=%2FfakeId')
        .reply(200, response),

      fakeGet2 = nock('https://services.humanbrainproject.eu')
        .get('/storage/v1/api/project/' + fileUuid + '/children/')
        .replyWithFile(200, path.join(__dirname, 'replies/contents.json')),

      expected = {
        uuid: '53ab549f-030f-4d0f-ac82-eac66a181092',
        name: 'arm_reinforcement_learning.py',
        parent: 'fbdaba55-2012-40d9-b466-017cff025c36'
      };

    return expect(collabStorage.listExperiments(fakeToken))
      .to.eventually.be.an('array').that.include(expected);
  });

  //list experiments by contextId
  it('should list all experiments available to the user', () => {
    const fileUuid = '53ab549f-030f-4d0f-ac82-eac66a181092',

      response = JSON.stringify({
        'uuid': '53ab549f-030f-4d0f-ac82-eac66a181092',
        'entity_type': 'file',
        'name': 'arm_reinforcement_learning.py',
        'description': '',
        'content_type': 'text/x-python',
        'parent': 'fbdaba55-2012-40d9-b466-017cff025c36',
        'created_by': '302416',
        'created_on': '2017-02-10T15:20:16.514456Z',
        'modified_by': '302416',
        'modified_on': '2017-02-10T15:20:22.493599Z'
      }),

      fakeGet = nock('https://services.humanbrainproject.eu')
        .get('/storage/v1/api/entity/?path=%2FfakeId')
        .reply(200, response),

      fakeGet2 = nock('https://services.humanbrainproject.eu')
        .get('/storage/v1/api/project/' + fileUuid + '/children/')
        .replyWithFile(200, path.join(__dirname, 'replies/contents.json')),

      expected = {
        uuid: '53ab549f-030f-4d0f-ac82-eac66a181092',
        name: 'arm_reinforcement_learning.py',
        parent: 'fbdaba55-2012-40d9-b466-017cff025c36'
      };

    nock('https://services.humanbrainproject.eu')
      .get('/collab/v0/collab/context/contextid/')
      .reply(200, '{ "collab": { "id":"fakeId"}}');

    return expect(collabStorage.listExperiments(fakeToken, 'contextid'))
      .to.eventually.be.an('array').that.include(expected);
  });

  it('should throw when doing a dummy request', () => {
    const response = nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/fakeFile/content/')
      .reply(404, 'error!');

    return expect(collabStorage.getFile('fakeFile', fakeExperiment, fakeToken))
      .to.eventually.be.rejected;
  });

  //create experiment
  it('should create a new experiment ', () => {
    const
      fileUuid = '53ab549f-030f-4d0f-ac82-eac66a181092',

      fakePost = nock('https://services.humanbrainproject.eu')
        .post('/storage/v1/api/folder/')
        .reply(200, 'Success');

    return collabStorage.createExperiment(fakeExperiment, fakeToken)
      .should.eventually.equal('Success');
  });

  it('should redirect if there is an authentication error (403)', () => {
    const response = nock('https://services.humanbrainproject.eu')
      .get('/storage/v1/api/file/fakeFile/content/')
      .reply(403, 'error!');

    return expect(collabStorage.getFile('fakeFile', fakeExperiment, fakeToken))
      .to.eventually.be.rejected;
  });

});
