'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var nock = require('nock');
var rewire = require('rewire');
var _ = require('underscore');

var serversProxy = rewire('../../proxy/serversProxy.js');
var testConf = require('../utils/testConf.js');

describe('serversProxy', function() {
  beforeEach(function() {
    nock.cleanAll();
    serversProxy.__set__('console', testConf.consoleMock);
  });

  it('should set authToken', function() {
    serversProxy.setToken('testToken');
    serversProxy.__get__('authToken').should.deep.equal('testToken');
  });

  it('should return the correct list of experiments', function() {
    testConf.mockResponses();
    var experiments = serversProxy.getExperimentsAndSimulations(
      testConf.config
    );
    return experiments.then(function(x) {
      expect(
        x[0].experimentConf1[0].runningSimulation.experimentConfiguration
      ).to.equal(
        testConf.experimentList.experiment1.configuration
          .experimentConfiguration
      );
      expect(_.isEqual(x[1], testConf.serveserverSimulations)).to.equal(true);
    });
  });

  it('should NOT fail to return experiments due a non-JSON response', function() {
    testConf.mockNonJsonResponses();
    var exp = serversProxy.getExperimentsAndSimulations(testConf.config);
    return exp.should.eventually.deep.equal([{}, {}, []]);
  });

  it('should NOT fail to return experiments due to a failed response', function() {
    testConf.mockFailedResponses();
    var exp = serversProxy.getExperimentsAndSimulations(testConf.config);
    return exp.should.eventually.deep.equal([{}, {}, []]);
  });
});
