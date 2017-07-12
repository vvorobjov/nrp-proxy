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

var requestHandler = rewire('../../proxy/requestHandler.js');
var testConf = rewire('../utils/testConf');

var revert = function () {};

describe('requestHandler', function () {

  beforeEach(function () {
    nock.cleanAll();
    testConf.mockResponses();
    testConf.mockSuccessfulOidcResponse();
    requestHandler.initialize();
    requestHandler.__set__({
      'console': testConf.consoleMock,
      'configuration': testConf.config,
    });
  });

  afterEach(function () {
    revert();
  });

  it('should return a complete list of experiments', function () {
    revert = requestHandler.__set__('experimentList', testConf.experimentListNoCTXID);
    return requestHandler.getExperiments()
      .should.eventually.deep.equal(testConf.experimentListNoCTXID);
  });


  it('should return an empty experiment list', function() {
    return requestHandler.getExperiments()
      .should.eventually.deep.equal({});
  });

  it('should return a response indicating that the server was not found', function (done) {
    requestHandler.getServer('NonExistentServer')
      .catch(function (data) {
        expect(data).to.equal('\'serverId\' not found\n');
        done();
      });
  });

  it('should return joinable servers for a given contextid', function () {
    revert = requestHandler.__set__('simulationList', testConf.serveserverSimulations);
    var myobj = [{
      server: 'geneva4',
      runningSimulation: testConf.serveserverSimulations['geneva4'][0]
    }];
    return expect(requestHandler.getJoinableServers(testConf.CTX_ID))
      .to.eventually.deep.equal(myobj);
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
      configuration: undefined
    });
    requestHandler.reloadConfiguration();
    sinon.assert.calledOnce(errorSpy);
  });
});
