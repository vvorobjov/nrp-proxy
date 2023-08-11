'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const rewire = require('rewire');
const path = require('path');
const { expect } = chai;

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
  const userInfoEndpoint = '/protocol/openid-connect/userinfo';

  const userInfoResponse = {
    name: 'test-name',
    preferred_username: 'test-username',
    roles: {
      group: ['group1', 'group2']
    }
  };
  const userInfoExpect = {
    displayName: 'test-name',
    username: 'test-username',
    id: 'test-username',
    roles: {
      group: ['group1', 'group2']
    }
  };

  let identity;

  beforeEach(() => {
    identity = new IdentityRewire.Identity();
    nock('https://localhost')
      .get(userInfoEndpoint)
      .reply(200, userInfoResponse);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it(`should return self user info`, async () => {
    const userInfo = await identity.getUserInfo('me', fakeToken);
    expect(userInfo).to.deep.equal(userInfoExpect);
  });

  it(`should return id on getUniqueIdentifier`, async () => {
    const uniqueId = await identity.getUniqueIdentifier('sometoken');
    expect(uniqueId).to.equal(userInfoExpect.id);
  });

  it(`should handle error from the server`, async () => {
    nock.cleanAll();
    nock('https://localhost')
      .get(userInfoEndpoint)
      .reply(500, 'Internal Server Error');

    await expect(identity.getUserInfo('me', fakeToken)).to.be.rejected;
  });

  it(`should return user groups`, async () => {
    const userGroups = await identity.getUserGroups(fakeToken);
    expect(userGroups).to.deep.equal(userInfoExpect.roles.group);
  });

  it(`should return users list`, async () => {
    const expectedUsersList = [
      {
        displayName: 'test-name',
        id: 'test-username',
        username: 'test-username'
      }
    ];

    const usersList = await identity.getUsersList(fakeToken);
    expect(usersList).to.deep.equal(expectedUsersList);
  });

  it(`should cache users list`, async () => {
    const expectedUsersList = [
      {
        displayName: 'test-name',
        id: 'test-username',
        username: 'test-username'
      }
    ];

    let usersList = await identity.getUsersList(fakeToken);
    expect(usersList).to.deep.equal(expectedUsersList);

    // The second time we call getUsersList, the list is served from the cache and the HTTP request is not performed.
    nock.cleanAll();
    usersList = await identity.getUsersList(fakeToken);
    expect(usersList).to.deep.equal(expectedUsersList);
  });
});
