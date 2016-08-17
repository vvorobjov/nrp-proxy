'use strict';

var nock = require('nock');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var should = chai.should();

var oidcAuthenticator = require('../oidcAuthenticator.js');
var testConf = require('../utils/testConf.js');

describe('oidcAuthenticator', function () {

  var URL = 'http://localhost';
  var CLIENT_ID = 'CLIENT_ID';
  var CLIENT_SECRET = 'CLIENT_SECRET';

  it('should request a token successfully', function () {
    testConf.mockSuccessfulOidcResponse();
    var token = oidcAuthenticator(URL).getToken(CLIENT_ID, CLIENT_SECRET);
    return token.should.eventually.equal('testToken');
  });

  it('should fail when server fails', function () {
    testConf.mockFailedOidcResponse();
    var token = oidcAuthenticator(URL).getToken(CLIENT_ID, CLIENT_SECRET);
    return token.should.be.rejected;
  });

  it('should fail when server returns non JSON response', function () {
    testConf.mockNonJsonOidcResponse();
    var token = oidcAuthenticator(URL).getToken(CLIENT_ID, CLIENT_SECRET);
    return token.should.be.rejected;
  });

  it('should fail when server request fails', function () {
    return oidcAuthenticator(URL).getToken(CLIENT_ID, CLIENT_SECRET).should.be.rejected;
  });
});