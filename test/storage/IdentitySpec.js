'use strict';

const chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  path = require('path');

chai.use(chaiAsPromised);

describe('FSidentity', () => {
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24';
  let identity;

  beforeEach(() => {
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock') };
    const DB = rewire('../../storage/FS/DB');
    DB.__set__('utils', mockUtils);
    const IdentityRewire = rewire('../../storage/FS/Identity');
    IdentityRewire.__set__('DB', DB.default);
    identity = new IdentityRewire.Identity();
  });

  it(`should return users list`, () => {
    var expectedResult = [
      {
        displayName: 'nrpuser',
        id: 'nrpuser',
        username: 'nrpuser'
      },
      {
        displayName: 'admin',
        id: 'admin',
        username: 'admin'
      }
    ];

    return identity.getUsersList().should.eventually.deep.equal(expectedResult);
  });

  it(`should return self user info`, () => {
    return identity.getUserInfo('me', fakeToken).should.eventually.deep.equal({
      id: 'nrpuser',
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
      .should.eventually.deep.equal(['hbp-sp10-user-edit-rights']);
  });

  it(`should return the default group plus admin group`, () => {
    let expectedGroup = ['hbp-sp10-user-edit-rights', 'group-HBP-NRP-Admins'];
    return identity
      .getUserGroups(fakeToken, 'admin')
      .should.eventually.deep.equal(expectedGroup);
  });
});

describe('Collabidentity', () => {
  const nock = require('nock');
  const fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24';
  const IdentityRewire = rewire('../../storage/Collab/Identity');

  let identity;

  beforeEach(() => {
    identity = new IdentityRewire.Identity();
  });

  it(`should return self user info`, () => {
    const response = {
      id: 'default-owner',
      displayName: 'nrpuser'
    };

    nock('https://localhost')
      .get('/protocol/openid-connect/userinfo')
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

    nock('https://localhost')
      .get('/protocol/openid-connect/userinfo')
      .reply(200, response);

    return identity
      .getUniqueIdentifier('sometoken')
      .should.eventually.equal(response.id);
  });

  // it(`should return default groups`, () => {
  //   const groups = [{ name: 'hbp-sp10-user-edit-rights' }],
  //     response = {
  //       _embedded: { groups: groups }
  //     };

  //   nock('http://localhost')
  //     .get('/idm/v1/api/user/me/member-groups?page=0&pageSize=1000')
  //     .reply(200, response);

  //   return identity.getUserGroups().should.eventually.deep.equal(groups);
  // });

  // it(`should return users list`, () => {
  //   var expectedResult = [
  //     {
  //       displayName: 'nrpuser',
  //       id: 'nrpuser',
  //       username: 'nrpuser'
  //     },
  //     {
  //       displayName: 'admin',
  //       id: 'admin',
  //       username: 'admin'
  //     }
  //   ];

  //   nock('http://localhost')
  //     .get(/\/idm\/v1\/api\/user/)
  //     .reply(200, {
  //       _embedded: {
  //         users: [
  //           {
  //             displayName: 'nrpuser',
  //             id: 'nrpuser',
  //             username: 'nrpuser'
  //           }
  //         ]
  //       },
  //       page: {
  //         number: 0,
  //         totalPages: 2
  //       }
  //     });
  //   nock('http://localhost')
  //     .get(/\/idm\/v1\/api\/user/)
  //     .reply(200, {
  //       _embedded: {
  //         users: [
  //           {
  //             displayName: 'admin',
  //             id: 'admin',
  //             username: 'admin'
  //           }
  //         ]
  //       },
  //       page: {
  //         number: 1,
  //         totalPages: 2
  //       }
  //     });

  //   return identity.getUsersList().should.eventually.deep.equal(expectedResult);
  // });
});
