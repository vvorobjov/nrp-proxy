'use strict';

const fs = require('fs'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  expect = chai.expect,
  should = chai.should(),
  path = require('path'),
  assert = chai.assert;
chai.use(chaiAsPromised);

describe('BaseAuthenticator', () => {
  const BaseAuthenticator = require('../../storage/BaseAuthenticator.js');
  let baseClassMock;
  //to test the non overidden methods of the BaseAuthenticator we have to provide an empty
  //implementation and instantiate it
  class BaseClassMock extends BaseAuthenticator {
    constructor() {
      super();
    }
  }

  beforeEach(() => {
    baseClassMock = new BaseClassMock();
  });

  it(`should throw a TypeError exception when trying to instanciate the BaseAuthenticator`, () => {
    return expect(() => { return new BaseAuthenticator(); }).to.throw(TypeError, 'BaseAuthenticator is an abstract class');
  });

  it('should throw a non implemented method error when trying to use a base class non-overidden function', () => {
    return expect(baseClassMock.login).to.throw('not implemented');
  });

  it('should throw a non implemented method error when trying to use a base class non-overidden function', () => {
    return expect(baseClassMock.checkToken).to.throw('not implemented');
  });
});

describe('FSAuthenticator', () => {
  let RewiredDB, RewiredFSAuthenticator, testDB, fsAuthenticator;
  const AUTHORIZATION_ERROR = {
    code: 403
  },
    fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24';

  beforeEach(() => {
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock') };
    RewiredDB = rewire('../../storage/FS/DB.js');
    RewiredDB.__set__('utils', mockUtils);
    RewiredFSAuthenticator = rewire('../../storage/FS/Authenticator.js');
    RewiredFSAuthenticator.__set__('DB', RewiredDB);
    testDB = new RewiredDB();
    fsAuthenticator = new RewiredFSAuthenticator();
  });

  it(`should successfully return a user token provided a correct combination of user name and password `, () => {
    return fsAuthenticator.login('nrpuser', 'password').should.eventually.equal(fakeToken);
  });

  it(`should return an authorization error when we provide an incorrect password`, () => {
    return assert.isRejected(fsAuthenticator.login('nrpuser', 'wrongPassword'), AUTHORIZATION_ERROR);
  });

  it(`should return an authentication error when we provide an incorrect username`, () => {
    return assert.isRejected(fsAuthenticator.login('wrongUser', 'password'), AUTHORIZATION_ERROR);
  });
  //check token function tests
  it(`should check if correct token exists in the database`, () => {
    return fsAuthenticator.checkToken(fakeToken)
      .should.eventually.contain({ token: fakeToken });
  });

  it(`should throw an authoriaztion error if we are providing the wrong token error`, () => {
    return assert.isRejected(fsAuthenticator.checkToken('wrongToken'), AUTHORIZATION_ERROR);
  });
});

describe('CollabAuthenticator', () => {
  const CollabAuthenticator = require('../../storage/Collab/Authenticator.js');
  let collabAuth = new CollabAuthenticator();
  it('should return an empty promise when trying to authenticate', () => {
    return collabAuth.checkToken('emptyToken').should.eventually.equal(undefined);
  });
});
