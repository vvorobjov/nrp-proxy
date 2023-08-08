'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var nock = require('nock');
var rewire = require('rewire');
const _ = require('lodash');
var serversProxyRewire = rewire('../../proxy/serversProxy');
const serversProxy = serversProxyRewire.default;
var testConf = require('../utils/testConf.js');

describe('serversProxy', function() {
  beforeEach(function() {
    nock.cleanAll();
    serversProxyRewire.__set__('console', testConf.consoleMock);
  });

  it('should set authToken', function() {
    serversProxy.setToken('testToken');
    serversProxyRewire.__get__('authToken').should.deep.equal('testToken');
  });

  it('should return the correct list of experiments', function() {
    testConf.mockResponses();
    var experiments = serversProxy.getExperimentsAndSimulations(
      testConf.config
    );
    return experiments.then(function(x) {
      expect(x[0].experimentConf1[0].runningSimulation.experimentId).to.equal(
        testConf.experimentList.experiment1.configuration.experimentId
      );
      expect(_.isEqual(x[1], testConf.serverSimulations)).to.equal(true);
    });
  });

  it("should return the correct list of experiments using backend's internal IP", function() {
    testConf.mockResponsesInternalIp();
    var experiments = serversProxy.getExperimentsAndSimulations(
      testConf.configInternalIp
    );
    return experiments.then(function(x) {
      expect(x[0].experimentConf1[0].runningSimulation.experimentId).to.equal(
        testConf.experimentList.experiment1.configuration.experimentId
      );
      expect(_.isEqual(x[1], testConf.serverSimulations)).to.equal(false);
    });
  });

  it('should NOT fail to return experiments due a non-JSON response', function() {
    testConf.mockNonJsonResponses();
    return serversProxy
      .getExperimentsAndSimulations(testConf.config)
      .then(function(exp) {
        expect(exp[0]).to.deep.equal({});
        expect(exp[1]).to.deep.equal({});
        expect(exp[2]).to.deep.equal([]);
        expect(exp[3]).to.have.members(
          testConf.SERVERS.map(serverKey => testConf.config.servers[serverKey])
        );
      });
  });

  it('should NOT fail to return experiments due to a failed response', function() {
    testConf.mockFailedResponses();
    return serversProxy
      .getExperimentsAndSimulations(testConf.config)
      .then(function(exp) {
        expect(exp[0]).to.deep.equal({});
        expect(exp[1]).to.deep.equal({});
        expect(exp[2]).to.deep.equal([]);
        expect(exp[3]).to.have.members(
          testConf.SERVERS.map(serverKey => testConf.config.servers[serverKey])
        );
      });
  });
});
