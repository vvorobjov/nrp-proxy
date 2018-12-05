'use strict';

const chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path');

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
    return expect(() => {
      return new BaseIdentity();
    }).to.throw(TypeError, 'BaseIdentity is an abstract class');
  });

  //for all the non implemented methods of the base class
  [
    'getUserInfo',
    'getUserGroups',
    'getUniqueIdentifier',
    'getUsersList',
    'getUserToken'
  ].forEach(method => {
    it(
      'should throw a non implemented method error when trying to use the base class non-overidden function: ' +
        method,
      () => {
        return expect(baseClassMock[method]).to.throw('not implemented');
      }
    );
  });
});

describe('FSidentity', () => {
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24';
  const fakeName = 'nrpuser';
  let identity;

  beforeEach(() => {
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock') };
    const DB = rewire('../../storage/FS/DB.js');
    DB.__set__('utils', mockUtils);
    const Identity = rewire('../../storage/FS/Identity.js');
    Identity.__set__('DB', DB);
    identity = new Identity();
  });

  it(`should return self user token`, () => {
    return identity.getUserToken(fakeName).should.eventually.deep.equal({
      token: fakeToken
    });
  });
  it(`should return self user info`, () => {
    var expectedResult = ['nrpuser', 'admin'];

    return identity.getUsersList().should.eventually.deep.equal(expectedResult);
  });

  it(`should return self user info`, () => {
    return identity.getUserInfo('me', fakeToken).should.eventually.deep.equal({
      id: 'default-owner',
      displayName: 'nrpuser'
    });
  });

  it(`should return a rejection on getUniqueIdentifier`, () => {
    return identity.getUniqueIdentifier('fakeToken').should.be.eventually
      .rejected;
  });
  it(`should return specific user info`, () => {
    return identity
      .getUserInfo('nrpuser', fakeToken)
      .should.eventually.deep.equal({ id: 'nrpuser', displayName: 'nrpuser' });
  });

  it(`should return a rejection when user is not found`, () => {
    return identity.getUserInfo('fakeuser', fakeToken).should.be.eventually
      .rejected;
  });

  it(`should return default groups`, () => {
    return identity
      .getUserGroups()
      .should.eventually.deep.equal([{ name: 'hbp-sp10-user-edit-rights' }]);
  });

  it(`should return the default group plus admin group`, () => {
    let expectedGroup = [
      { name: 'hbp-sp10-user-edit-rights' },
      { name: 'hbp-sp10-administrators' }
    ];
    return identity
      .getUserGroups(fakeToken, 'admin')
      .should.eventually.deep.equal(expectedGroup);
  });
});

describe('Collabidentity', () => {
  const nock = require('nock');
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24';
  const Identity = rewire('../../storage/Collab/Identity.js');

  let identity;

  beforeEach(() => {
    identity = new Identity();
  });

  it(`should return self user info`, () => {
    const response = {
      id: 'default-owner',
      displayName: 'nrpuser'
    };

    nock('https://services.humanbrainproject.eu')
      .get('/idm/v1/api/user/me')
      .reply(200, response);

    return identity
      .getUserInfo('me', fakeToken)
      .should.eventually.deep.equal(response);
  });

  it(`should return id on getUniqueIdentifier`, () => {
    const response = {
      id: 'default-owner',
      displayName: 'nrpuser'
    };

    nock('https://services.humanbrainproject.eu')
      .get('/idm/v1/api/user/me')
      .reply(200, response);

    return identity
      .getUniqueIdentifier('sometoken')
      .should.eventually.equal(response.id);
  });

  it(`should return default groups`, () => {
    const groups = [{ name: 'hbp-sp10-user-edit-rights' }],
      response = {
        _embedded: { groups: groups }
      };

    nock('https://services.humanbrainproject.eu')
      .get('/idm/v1/api/user/me/member-groups?page=0&pageSize=1000')
      .reply(200, response);

    return identity.getUserGroups().should.eventually.deep.equal(groups);
  });
});
