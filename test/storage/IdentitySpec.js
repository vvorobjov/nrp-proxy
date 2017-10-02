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

describe('BaseIdentity', () => {
  const BaseIdentity = require('../../storage/BaseIdentity.js');
  let baseClassMock;
  //to test the non overidden methods of the BaseAuthenticator we have to provide an empty
  //implementation and instantiate it
  class BaseIdentityMock extends BaseIdentity {
    constructor() {
      super();
    }
  }

  beforeEach(() => {
    baseClassMock = new BaseIdentityMock();
  });

  it(`should throw a TypeError exception when trying to instanciate the BaseAuthenticator`, () => {
    return expect(() => { return new BaseIdentity(); }).to.throw(TypeError, 'BaseIdentity is an abstract class');
  });

  //for all the non implemented methods of the base class
  ['getUserInfo', 'getUserGroups'].forEach(method => {
    it('should throw a non implemented method error when trying to use the base class non-overidden function: ' + method, () => {
      return expect(baseClassMock[method]).to.throw('not implemented');
    });
  });
});


describe('FSidentity', () => {
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24';
  let identity;

  beforeEach(() => {
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock') };
    const DB = rewire('../../storage/FS/DB.js');
    DB.__set__('utils', mockUtils);
    const Identity = rewire('../../storage/FS/Identity.js');
    Identity.__set__('DB', DB);
    var empty = (path, callback) => {
      //empty implementation just to check if fs functions are called
      callback();
    };
    identity = new Identity();
  });

  it(`should return self user info`, () => {
    return identity.getUserInfo('me', fakeToken)
      .should.eventually.deep.equal({ id: 'default-owner', displayName: 'nrpuser' });
  });

  it(`should return specific user info`, () => {
    return identity.getUserInfo('nrpuser', fakeToken)
      .should.eventually.deep.equal({ id: 'nrpuser', displayName: 'nrpuser' });
  });

  it(`should return default groups`, () => {
    return identity.getUserGroups()
      .should.eventually.deep.equal([{ name: 'hbp-sp10-user-edit-rights' }]);
  });
});
