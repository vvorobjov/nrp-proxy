'use strict';

var nock = require('nock');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var should = chai.should();

var oidcAuthenticator = require('../oidcAuthenticator.js');


describe('oidcAuthenticator', function () {

  var URL = 'http://localhost';
  var CLIENT_ID = 'CLIENT_ID';
  var CLIENT_SECRET = 'CLIENT_SECRET';

  it('should request a token successfully', function () {

    nock(URL)
      .post('/token')
      .reply(200, { 'access_token': 'testToken' });

    var token = oidcAuthenticator(URL).getToken(CLIENT_ID, CLIENT_SECRET);
    nock.isDone();

    return token.should.eventually.equal('testToken');
  });

  it('should fail when server fails', function () {
    nock(URL)
      .post('/token')
      .reply(500, {});

    var token = oidcAuthenticator(URL).getToken(CLIENT_ID, CLIENT_SECRET);
    nock.isDone();

    return token.should.be.rejected;
  });

  it('should fail when server returns non JSON response', function () {
    nock(URL)
      .post('/token')
      .reply(200, 'OK!');

    var token = oidcAuthenticator(URL).getToken(CLIENT_ID, CLIENT_SECRET);
    nock.isDone();

    return token.should.be.rejected;
  });

  it('should fail when server request fails', function () {
    return oidcAuthenticator(URL).getToken(CLIENT_ID, CLIENT_SECRET).should.be.rejected;
  });
});

