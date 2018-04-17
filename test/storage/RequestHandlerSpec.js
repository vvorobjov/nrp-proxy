'use strict';

const fs = require('fs'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path'),
  assert = chai.assert,
  q = require('q'),
  chaiSubset = require('chai-subset');
chai.use(chaiAsPromised);
chai.use(chaiSubset);

let StorageRequestHandler = rewire('../../storage/requestHandler.js');
class fakeCloner {
  constructor() {}
  cloneExperiment() {}
}
const fakeExpCloner = {
  TemplateExperimentCloner: fakeCloner,
  NewExperimentCloner: fakeCloner
};
StorageRequestHandler.__set__('ExperimentCloner', fakeExpCloner);
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
    RewiredIdentity = rewire('../../storage/FS/Identity');
    RewiredIdentity.__set__('DB', RewiredDB);
    mkdirCalls = 0;

    var fakeMkdir = (path, callback) => {
      mkdirCalls++;
      callback();
    };

    var fakeRmdir = (path, callback) => {
      rmdirCalls++;
      callback();
    };

    RewiredFSStorage.__set__('fs.statSync', fakeStatSync);
    RewiredFSStorage.__set__('fs.mkdir', fakeMkdir);
    RewiredFSStorage.__set__('rmdir', fakeRmdir);
    fsStorage = new RewiredFSStorage();
    RewiredFSAuthenticator = rewire('../../storage/FS/Authenticator.js');
    RewiredFSAuthenticator.__set__('DB', RewiredDB);
    fsAuthenticator = new RewiredFSAuthenticator();
    identity = new RewiredIdentity();
    storageRequestHandler.authenticator = fsAuthenticator;
    storageRequestHandler.storage = fsStorage;
    storageRequestHandler.identity = identity;
  });

  it('should authenticate successfully', () => {
    return storageRequestHandler
      .authenticate('nrpuser', 'password')
      .should.eventually.equal(fakeToken);
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

  //deleteFile
  it(`should succesfully delete an Experiment`, () =>
    storageRequestHandler
      .deleteExperiment('fakeExperiment', 'fakeExperiment', fakeToken)
      .catch(err => expect(err).to.deep.equal({ code: 403 })));

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
          .listFiles(fakeExperiment, fakeToken, fakeUserId)
          .then(folderContents => {
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
    const expectedResp = [
      {
        description: 'Clearpath Robotics Husky A200 - Extended HBP Model',
        name: 'HBP Clearpath Robotics Husky A200',
        path: 'nrpuser%2Frobots%2Fhusky_model.zip',
        thumbnail: 'data:image/png;base64,dGVzdA==',
        fileName: 'nrpuser/robots/husky_model.zip'
      }
    ];

    return storageRequestHandler
      .listCustomModels('robots', fakeToken)
      .should.eventually.deep.equal(expectedResp);
  });

  // getUserInfo success
  it(`should successfully return the user info`, () => {
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
      return q.when('test');
    };
    return storageRequestHandler
      .createCustomModel('robots', fakeToken, 'test.zip', null)
      .should.eventually.equal('test');
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
        return q.when('test');
      },
      validateZip: function() {
        return q.when('test');
      }
    };
    StorageRequestHandler.__set__('customModelService', fakeCustomModels);
    var storageRequestHandler2 = new StorageRequestHandler(configFile);
    storageRequestHandler2.createCustomModel = function() {
      return 'success';
    };
    return storageRequestHandler2
      .createZip(fakeToken, 'robots', 'test.zip', 'fakeZip', null)
      .should.eventually.equal('success');
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
    storageRequestHandler.getUserIdentifier = () => q.resolve('nrpuser');

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
