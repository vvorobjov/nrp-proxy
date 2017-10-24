'use strict';

const fs = require('fs'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path'),
  assert = chai.assert,
  q = require('q');
chai.use(chaiAsPromised);

const StorageRequestHandler = require('../../storage/requestHandler.js');
let configFile = {};
configFile.storage = { type: 'FS' };

//Storage request handler
describe('Storage request handler', () => {
  let RewiredDB,
    RewiredFSAuthenticator,
    RewiredFSStorage,
    fsAuthenticator,
    storageRequestHandler,
    fsStorage;

  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24',
    fakeExperiment = '21f0f4e0-9753-42f3-bd29-611d20fc1168',
    AUTHORIZATION_ERROR = {
      code: 403
    };

  let mkdirCalls = 0;
  let rmdirCalls = 0;
  beforeEach(() => {
    storageRequestHandler = new StorageRequestHandler(configFile);
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock') };
    RewiredDB = rewire('../../storage/FS/DB.js');
    RewiredDB.__set__('utils', mockUtils);
    RewiredFSStorage = rewire('../../storage/FS/Storage.js');
    RewiredFSStorage.__set__('DB', RewiredDB);
    RewiredFSStorage.__set__('utils', mockUtils);
    mkdirCalls = 0;

    var fakeMkdir = (path, callback) => {
      mkdirCalls++;
      callback();
    };

    var fakeRmdir = (path, callback) => {
      rmdirCalls++;
      callback();
    };

    RewiredFSStorage.__set__('fs.mkdir', fakeMkdir);
    RewiredFSStorage.__set__('rmdir', fakeRmdir);
    fsStorage = new RewiredFSStorage();
    RewiredFSAuthenticator = rewire('../../storage/FS/Authenticator.js');
    RewiredFSAuthenticator.__set__('DB', RewiredDB);
    fsAuthenticator = new RewiredFSAuthenticator();
    storageRequestHandler.authenticator = fsAuthenticator;
    storageRequestHandler.storage = fsStorage;
  });

  it('should authenticate successfully', () => {
    return storageRequestHandler
      .authenticate('nrpuser', 'password')
      .should.eventually.equal(fakeToken);
  });

  //listFiles
  it(`should list all the files contained in a certain experiment`, () => {
    return expect(storageRequestHandler.listFiles(fakeExperiment, fakeToken))
      .to.eventually.be.an('array')
      .that.include({
        name: 'fakeFile',
        uuid: '21f0f4e0-9753-42f3-bd29-611d20fc1168/fakeFile',
        size: 11,
        type: 'file'
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
    return q.denodeify(fs.writeFile)(tmpFilePath, 'fakeContent').then(() => {
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

  //create or update file
  it(`should create a new file when we call the createOrUpdateFunction`, () => {
    //create a tmp file
    return storageRequestHandler
      .createOrUpdate(
        'tmp',
        'emptyContent',
        'text/plain',
        fakeExperiment,
        fakeToken
      )
      .then(() => {
        return fsStorage
          .listFiles(fakeExperiment, fakeToken)
          .then(folderContents => {
            //clean up the tmp file
            fsStorage.deleteFile(
              fakeExperiment + '/tmp',
              fakeExperiment,
              fakeToken
            );
            return expect(folderContents).to.include({
              name: 'tmp',
              uuid: '21f0f4e0-9753-42f3-bd29-611d20fc1168/tmp',
              size: 12,
              type: 'file'
            });
          });
      });
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
      .then(() => expect(rmdirCalls).to.equal(1));
  });

  //listExperiments
  it(`should list all the experiments the current token provides`, () => {
    const expected = {
      uuid: fakeExperiment,
      name: fakeExperiment
    };
    return storageRequestHandler
      .listExperiments(fakeToken)
      .should.eventually.contain(expected);
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
    RewiredDB2 = rewire('../../storage/FS/DB.js');
    RewiredDB2.__set__('utils', mockUtils2);
    RewiredFSAuthenticator = rewire('../../storage/FS/Authenticator.js');
    RewiredFSAuthenticator.__set__('DB', RewiredDB2);
    fsAuthenticator = new RewiredFSAuthenticator();
    storageRequestHandler.authenticator = fsAuthenticator;
    //mocking the storage db
    let newPath = path.join(__dirname, 'dbMock2');
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock2') };
    RewiredDB = rewire('../../storage/FS/DB.js');
    RewiredDB.__set__('utils', mockUtils);
    RewiredFSStorage = rewire('../../storage/FS/Storage.js');
    RewiredFSStorage.__set__('DB', RewiredDB);
    RewiredFSStorage.__set__('utils', mockUtils);
    fs.existsSync(newPath) || fs.mkdirSync(newPath);
    fsStorage = new RewiredFSStorage();
    storageRequestHandler.storage = fsStorage;

    return storageRequestHandler
      .createExperiment(fakeExperiment, fakeToken)
      .then(res => {
        fs.unlinkSync(path.join(__dirname, 'dbMock2/FS_db/experiments'));
        fs.rmdirSync(path.join(__dirname, 'dbMock2/FS_db/'));
        fs.rmdirSync(path.join(__dirname, 'dbMock2/'));
        return res['uuid'].should.contain('-');
      });
  });
});
