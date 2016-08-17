'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var should = chai.should();
var nock = require('nock');
var rewire = require('rewire');

var serversProxy = rewire('../serversProxy.js');
var testConf = require('../utils/testConf.js');

describe('serversProxy', function () {
  beforeEach(function () {
    nock.cleanAll();
    serversProxy.__set__('console', testConf.consoleMock);
  });

  it('should set authToken', function () {
    serversProxy.setToken('testToken');
    (serversProxy.__get__('authToken')).should.deep.equal('testToken');
  });

  it('should return the correct list of experiments', function () {
    testConf.mockResponses();
    var experiments = serversProxy.getExperiments(testConf.config);
    return experiments.should.eventually.deep.equal(testConf.experimentList);
  });

   it('should fail to return experiments due a non-JSON response', function () {
    testConf.mockNonJsonResponses();
    var exp = serversProxy.getExperiments(testConf.config);
    return exp.should.be.rejected;
  });

  it('should fail to return experiments due to a failed response', function () {
    testConf.mockFailedResponses();
    var exp = serversProxy.getExperiments(testConf.config);
    return exp.should.be.rejected;
  });

  it('should fail to get experiment image because experiment has neither available nor joinable servers', function () {
    return serversProxy.getExperimentImage('experiment3', testConf.experimentList, testConf.config)
      .should.eventually.deep.equal(['experiment3', null]);
  });

  it('should fail to get experimentImage because experiment doesn\'t exist in the list of experiments', function () {
    return serversProxy.getExperimentImage('nonExistentExperiment', testConf.experimentList, testConf.config)
      .should.eventually.deep.equal(['nonExistentExperiment', null]);
  });

  it('should return experiment image', function () {
    testConf.mockImageResponses();
    return serversProxy.getExperimentImage('experiment1', testConf.experimentList, testConf.config)
      .should.eventually.deep.equal(['experiment1', 'image']);
  });

  it('should fail to return the experiment image', function () {
    testConf.mockFailedImageResponse();
    return serversProxy.getExperimentImage('experiment2', testConf.experimentList, testConf.config)
      .should.eventually.deep.equal(['experiment2', null]);
  });
});