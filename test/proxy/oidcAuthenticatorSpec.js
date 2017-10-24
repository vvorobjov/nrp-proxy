'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

var oidcAuthenticator = require('../../proxy/oidcAuthenticator.js');
var testConf = require('../utils/testConf.js');

describe('oidcAuthenticator', function() {
  oidcAuthenticator.configure(testConf.config.auth);

  it('should request a token successfully', function() {
    testConf.mockSuccessfulOidcResponse();
    var token = oidcAuthenticator.getToken();
    return token.should.eventually.equal('testToken');
  });

  it('should fail when server fails', function() {
    testConf.mockFailedOidcResponse();
    var token = oidcAuthenticator.getToken();
    return token.should.be.rejected;
  });

  it('should fail when server returns non JSON response', function() {
    testConf.mockNonJsonOidcResponse();
    var token = oidcAuthenticator.getToken();
    return token.should.be.rejected;
  });

  it('should fail when server request fails', function() {
    return oidcAuthenticator.getToken().should.be.rejected;
  });
});
