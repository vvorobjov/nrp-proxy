'use strict';
/*jshint expr: true*/

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var rewire = require('rewire');
var sinon = require('sinon');
var nock = require('nock');

var requestHandler = rewire('../../proxy/requestHandler.js');
var testConf = rewire('../utils/testConf');

var revert = function() {};

describe('requestHandler', function() {
  beforeEach(function() {
    nock.cleanAll();
    testConf.mockResponses();
    testConf.mockSuccessfulOidcResponse();
    requestHandler.initialize(testConf.config);
    requestHandler.__set__({
      console: testConf.consoleMock,
      configuration: testConf.config
    });
  });

  afterEach(function() {
    revert();
  });

  it('should return a complete list of experiments', function() {
    revert = requestHandler.__set__(
      'experimentList',
      testConf.experimentListNoCTXID
    );
    return requestHandler
      .getExperiments()
      .should.eventually.deep.equal(testConf.experimentListNoCTXID);
  });

  it('should return an empty experiment list', function() {
    return requestHandler.getExperiments().should.eventually.deep.equal({});
  });

  it('should return a response indicating that the server was not found', function(
    done
  ) {
    requestHandler.getServer('NonExistentServer').catch(function(data) {
      expect(data).to.equal("'serverId' not found\n");
      done();
    });
  });

  it('should return joinable servers for a given experimentID', function() {
    revert = requestHandler.__set__(
      'simulationList',
      testConf.serveserverSimulations
    );
    var myobj = [
      {
        server: 'geneva4',
        runningSimulation: testConf.serveserverSimulations['geneva4'][0]
      }
    ];

    return requestHandler
      .getJoinableServers(testConf.EXPERIMENT_ID)
      .should.eventually.deep.equal(myobj);
  });

  it('should return available servers for a given experiment', function() {
    revert = requestHandler.__set__('experimentList', testConf.experimentList);
    return requestHandler
      .getAvailableServers('experiment1')
      .should.eventually.deep.equal(
        testConf.experimentList['experiment1'].availableServers
      );
  });

  it('should fail to get availableServers due to wrong experimentId', function(
    done
  ) {
    requestHandler
      .getAvailableServers('NonExistentExperiment')
      .catch(function(data) {
        expect(data).to.equal(
          "experimentId: 'NonExistentExperiment' not found\n"
        );
        done();
      });
  });

  it('should return server details', function() {
    return requestHandler
      .getServer(testConf.SERVERS[0])
      .should.eventually.deep.equal(
        testConf.config.servers[testConf.SERVERS[0]]
      );
  });

  it('should return getExperimentImageFile response', function() {
    var serversProxyGetExperimentImageSpy = sinon.spy();
    revert = requestHandler.__set__({
      'serversProxy.getExperimentImageFile': serversProxyGetExperimentImageSpy,
      experimentList: testConf.experimentList
    });
    return requestHandler
      .getExperimentImageFile('experiment1')
      .should.eventually.contain('experiment1/test.png');
  });

  it('should not find the configuration file and log the error', function() {
    var errorSpy = sinon.spy();
    var logSpy = sinon.spy();
    revert = requestHandler.__set__({
      console: {
        error: errorSpy,
        log: logSpy
      },
      configuration: undefined
    });
    try {
      requestHandler.reloadConfiguration();
    } catch (e) {
      e.should.equal(
        'Proxy requestHandler.reloadConfiguration: configuration required'
      );
    }
  });

  it('should reconfigure oidcAuthenticator on reloadConfiguration', function() {
    var configureSpy = sinon.spy();
    revert = requestHandler.__set__({
      oidcAuthenticator: {
        configure: configureSpy
      },
      configuration: undefined
    });
    try {
      requestHandler.reloadConfiguration({
        refreshInterval: 1000,
        modelsPath: ''
      });
    } catch (e) {
      e.should.equal(
        "Configuration key 'modelsPath' is missing in the config file. Please update"
      );
    }
  });

  it('should fail to getExperimentImageFile response', function() {
    var serversProxyGetExperimentImageSpy = sinon.spy();
    var errorSpy = sinon.spy();
    var logSpy = sinon.spy();
    revert = requestHandler.__set__({
      console: {
        error: errorSpy,
        log: logSpy
      },
      configuration: undefined,
      'serversProxy.getExperimentImageFile': serversProxyGetExperimentImageSpy,
      experimentList: testConf.experimentList
    });
    try {
      requestHandler.getExperimentImageFile('falseExperiment');
    } catch (e) {
      e.should.equal('falseExperiment');
    }
  });

  it('should get the models service object correctly', function() {
    var errorSpy = sinon.spy();
    var logSpy = sinon.spy();
    revert = requestHandler.__set__({
      console: {
        error: errorSpy,
        log: logSpy
      },
      configuration: undefined,
      experimentList: testConf.experimentList,
      modelsService: {
        getModels: () =>
          new Promise(function(resolve) {
            resolve('robot1');
          })
      }
    });
    return requestHandler
      .getModels('robots')
      .then(res => res.should.equal('robot1'));
  });
});
