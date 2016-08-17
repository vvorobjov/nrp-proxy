'use strict';
/*jshint expr: true*/

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var should = chai.should();
var expect = chai.expect;
var rewire = require('rewire');
var sinon = require('sinon');
var nock = require('nock');

var requestHandler = rewire('../requestHandler.js');
var testConf = rewire('../utils/testConf');

var revert = function () {};

describe('requestHandler', function () {
  beforeEach(function () {
    nock.cleanAll();
    testConf.mockResponses();
    testConf.mockSuccessfulOidcResponse();
    requestHandler.__set__({
      'console': testConf.consoleMock,
      'configuration': testConf.config,
    });
  });

  afterEach(function () {
    revert();
  });

  it('should return an error regarding the missing contextId', function (done) {
    requestHandler.getExperiments(Object.keys(testConf.experimentsConf)[0], null)
      .catch(function (data) {
        expect(data).to.equal('\'contextId\' query string missing\n');
        done();
      });
  });

  it('should return a complete list of experiments', function () {
    revert = requestHandler.__set__('experimentList', testConf.experimentListNoCTXID);
    return requestHandler.getExperiments(undefined, undefined)
      .should.eventually.deep.equal(testConf.experimentListNoCTXID);
  });

  it('should return a list of experiments based on a given contextId', function () {
    revert = requestHandler.__set__('experimentList', testConf.experimentList);
    return requestHandler.getExperiments('experiment2', testConf.CTX_ID)
      .should.eventually.deep.equal({'experiment2': testConf.experimentList['experiment2']});
  });

  it('should return an empty experiment list', function() {
    return requestHandler.getExperiments(undefined, undefined)
      .should.eventually.deep.equal({});
  });

  it('should return a response indicating that the server was not found', function (done) {
    requestHandler.getServer('NonExistentServer')
      .catch(function (data) {
        expect(data).to.equal('\'serverId\' not found\n');
        done();
      });
  });

  it('should return joinable servers for a given experiment', function () {
    revert = requestHandler.__set__('experimentList', testConf.experimentList);
    return requestHandler.getJoinableServers('experiment1')
      .should.eventually.deep.equal(testConf.experimentList['experiment1'].joinableServers);
  });

  it('should return available servers for a given experiment', function () {
    revert = requestHandler.__set__('experimentList', testConf.experimentList);
    return requestHandler.getAvailableServers('experiment1')
      .should.eventually.deep.equal(testConf.experimentList['experiment1'].availableServers);
  });

  it('should fail to get availableServers due to wrong experimentId', function(done) {
    requestHandler.getAvailableServers('NonExistentExperiment')
      .catch(function (data) {
        expect(data).to.equal('experimentId: \'NonExistentExperiment\' not found\n');
        done();
      });
  });

 it('should fail to get joinableServers due to wrong experimentId', function(done) {
    requestHandler.getJoinableServers('NonExistentExperiment')
      .catch(function (data) {
        expect(data).to.equal('experimentId: \'NonExistentExperiment\' not found\n');
        done();
      });
  });

  it('should return server details', function () {
    return requestHandler.getServer(testConf.SERVERS[0])
      .should.eventually.deep.equal(testConf.config.servers[testConf.SERVERS[0]]);
  });

  it('should return experimentImage response', function() {
    var serversProxyGetExperimentImageSpy = sinon.spy();
    revert = requestHandler.__set__({
      'serversProxy.getExperimentImage': serversProxyGetExperimentImageSpy,
      'experimentList': testConf.experimentList
    });
    requestHandler.getExperimentImage('experiment1');
    sinon.assert.calledOnce(serversProxyGetExperimentImageSpy);
  });

  it('should not find the configuration file and log the error', function () {
    var errorSpy = sinon.spy();
    var logSpy = sinon.spy();
    revert = requestHandler.__set__({
      console: {
        error: errorSpy,
        log: logSpy
      },
      CONFIG_FILE: '',
      configuration: undefined
    });
    requestHandler.reloadConfigFile();
    sinon.assert.calledOnce(errorSpy);
    sinon.assert.calledWith(logSpy,
      'config.json not found! Please create a config.json from config.json.sample and run again!');
  });
/*
  it('should call readConfigFile', function () {
    var readConfigFileSpy = sinon.spy();
    revert = requestHandler.__set__('readConfigFile', readConfigFileSpy);
    requestHandler.reloadConfigFile();
    sinon.assert.calledOnce(readConfigFileSpy);
  });
  */
});