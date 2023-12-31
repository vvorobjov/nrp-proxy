'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const rewire = require('rewire');
const expect = chai.expect;
const path = require('path');
const sinon = require('sinon');
const assert = chai.assert;
chai.use(chaiAsPromised);

describe('FSAuthenticator', () => {
  let RewiredDB, RewiredFSAuthenticator, fsAuthenticator;
  const AUTHORIZATION_ERROR = {
      code: 403
    },
    fakeToken = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24';

  beforeEach(() => {
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock') };
    RewiredDB = rewire('../../storage/FS/DB');
    RewiredDB.__set__('utils', mockUtils);
    RewiredFSAuthenticator = rewire('../../storage/FS/Authenticator');
    RewiredFSAuthenticator.__set__('DB', RewiredDB.default);
    fsAuthenticator = new RewiredFSAuthenticator.Authenticator();
  });

  it(`should successfully return a user token provided a correct combination of user name and password `, () => {
    return fsAuthenticator
      .login('nrpuser', 'password')
      .should.eventually.equal(fakeToken);
  }).timeout(15000);

  it(`should return an authorization error when we provide an incorrect password`, () => {
    return assert.isRejected(
      fsAuthenticator.login('nrpuser', 'wrongPassword'),
      AUTHORIZATION_ERROR
    );
  });

  it(`should return an authentication error when we provide an incorrect username`, () => {
    return assert.isRejected(
      fsAuthenticator.login('wrongUser', 'password'),
      AUTHORIZATION_ERROR
    );
  });
  //check token function tests
  it(`should check if correct token exists in the database`, () => {
    return fsAuthenticator
      .checkToken(fakeToken)
      .should.eventually.contain({ token: fakeToken });
  });

  it(`should throw an authoriaztion error if we are providing the wrong token error`, () => {
    return assert.isRejected(
      fsAuthenticator.checkToken('wrongToken'),
      AUTHORIZATION_ERROR
    );
  });
});

describe('CollabAuthenticator', () => {
  const {
    Authenticator: CollabAuthenticator
  } = require('../../storage/Collab/Authenticator');
  const nock = require('nock');
  const INTROSPECT_TOKEN_URL = '/protocol/openid-connect/token/introspect';

  it('should return the introspection endpoint response when token is active', () => {
    const response = { active: true, other: 'someData' };
    let collabAuth = new CollabAuthenticator({ storage: 'FS' });
    nock('http://localhost')
      .post(
        INTROSPECT_TOKEN_URL,
        'token=emptyToken&client_id=CLIENT_ID&client_secret=CLIENT_SECRET'
      )
      .matchHeader('content-type', 'application/x-www-form-urlencoded')
      .reply(200, response);

    return collabAuth
      .checkToken('emptyToken')
      .should.eventually.deep.equal(response);
  });

  it('should use the cache when the token is not expired', async () => {
    const collabAuth = new CollabAuthenticator({ storage: 'FS' });
    // Set up a Sinon clock to control the current time
    const clock = sinon.useFakeTimers();

    // Add a token to the cache that is set to expire in 10000 ms
    const testToken = 'testToken';
    const testResponse = 'testResponse';
    collabAuth.authCache.set(testToken, {
      time_ms: Date.now() + 10000,
      response: testResponse
    });

    // Call the checkToken method
    const response = await collabAuth.checkToken(testToken);

    // Assert that the response from checkToken is equal to the cached response
    expect(response).to.equal(testResponse);

    // Restore the Sinon clock after the test
    clock.restore();
  });

  it('should retrun proper error, when token is not active', () => {
    const response = { active: false, other: 'someData' };
    let collabAuth = new CollabAuthenticator({ storage: 'FS' });
    nock('http://localhost')
      .post(
        INTROSPECT_TOKEN_URL,
        'token=emptyToken&client_id=CLIENT_ID&client_secret=CLIENT_SECRET'
      )
      .matchHeader('content-type', 'application/x-www-form-urlencoded')
      .reply(200, response);

    return collabAuth
      .checkToken('emptyToken')
      .should.be.rejectedWith('Token is not active.');
  });

  it('should clean the token cache', () => {
    let collabAuth = new CollabAuthenticator({ storage: 'FS' });
    let clock = sinon.useFakeTimers();
    // Add a token to the cache that is set to expire in 10000 ms
    collabAuth.authCache.set('testToken', {
      time_ms: Date.now() + 10000,
      response: 'testResponse'
    });

    // Fast forward the Sinon clock by 20000 ms, which will cause the token to expire
    clock.tick(20000);

    // Manually call the cleanCache method
    collabAuth.cleanCache();

    // Assert that the expired token has been removed from the cache
    expect(collabAuth.authCache.has('testToken')).to.be.false;

    // Restore the Sinon clock after the test
    clock.restore();
  });

  it('should retrun proper error, when introspection response is not successful', () => {
    const response = { random: 'json', other: 'someData' };
    let collabAuth = new CollabAuthenticator({ storage: 'FS' });
    nock('http://localhost')
      .post(
        INTROSPECT_TOKEN_URL,
        'token=emptyToken&client_id=CLIENT_ID&client_secret=CLIENT_SECRET'
      )
      .matchHeader('content-type', 'application/x-www-form-urlencoded')
      .reply(403, response);

    return collabAuth
      .checkToken('emptyToken')
      .should.be.rejectedWith(/Status code: 403/);
  });

  it('should retrun proper error, when introspection response body is corrupted', () => {
    const response = 'Corrupted response body';
    let collabAuth = new CollabAuthenticator({ storage: 'FS' });
    nock('http://localhost')
      .post(
        INTROSPECT_TOKEN_URL,
        'token=emptyToken&client_id=CLIENT_ID&client_secret=CLIENT_SECRET'
      )
      .matchHeader('content-type', 'application/x-www-form-urlencoded')
      .reply(403, response);

    return collabAuth.checkToken('emptyToken').should.be.rejectedWith(response);
  });

  it('should resolve to true when trying to authenticate with collab storage', () => {
    let collabAuth = new CollabAuthenticator({ storage: 'Collab' });
    return collabAuth.checkToken('emptyToken').should.eventually.equal(true);
  });

  it('should throw not implemented when calling login methods', () => {
    try {
      expect(
        CollabAuthenticator.prototype.login('fakeUser', 'fakePwd')
      ).to.throw('not implemented');
    } catch (error) {
      expect(error).to.equal('not implemented');
    }

    try {
      expect(CollabAuthenticator.prototype.getLoginPage()).to.throw(
        'not implemented'
      );
    } catch (error) {
      expect(error).to.equal('not implemented');
    }
  });

  it('should not get user info when data is in cache', () => {
    const response = { id: 'some_id', active: true };
    let collabAuth = new CollabAuthenticator({ storage: 'FS' });
    nock('http://localhost')
      .get('/protocol/openid-connect/userinfo')
      .reply(200, response);

    nock('http://localhost')
      .post('/protocol/openid-connect/token/introspect')
      .reply(200, response);

    return collabAuth
      .checkToken('emptyToken')
      .should.eventually.deep.equal(response)
      .then(() => {
        nock.cleanAll();
        nock('http://localhost')
          .post('/protocol/openid-connect/token/introspect')
          .reply(200, response);
        return collabAuth.checkToken('emptyToken');
      })
      .should.eventually.deep.equal(response);

    // nock.cleanAll();
  });
});
