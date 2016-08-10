'use strict';

var _ = require('lodash');
var nock = require('nock');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var should = chai.should();

var serversProxy = require('../serversProxy.js');

describe('serversProxy', function () {
  var SIMULATION_STATES = {
    CREATED: 'created',
    STARTED: 'started',
    PAUSED: 'paused',
    INITIALIZED: 'initialized',
    HALTED: 'halted',
    FAILED: 'failed',
    STOPPED: 'stopped'
  };

  var CTX_ID = 'ctxId',
    BASE_URL = 'http://localhost';

  var config, serveserverSimulations, serversStatus,
    serverExperiments, experimentsConf;

  beforeEach(function () {
    var SERVERS = ['geneva1', 'geneva2', 'geneva3', 'geneva4'];

    config = { servers: {} };
    //build server config
    SERVERS.forEach(function (server) {
      config.servers[server] = {
        gzweb: {
          assets: BASE_URL + '/' + server,
          'nrp-services': BASE_URL + '/' + server
        }
      };
    });

    experimentsConf = {
      experiment1: { experimentConfiguration: 'experimentConf1' },
      experiment2: { experimentConfiguration: 'experimentConf2' }
    };

    serverExperiments = {
      geneva1: { experiment1: experimentsConf.experiment1 },
      geneva2: { experiment1: experimentsConf.experiment1, experiment2: experimentsConf.experiment2 },
      geneva3: { experiment1: experimentsConf.experiment1, experiment2: experimentsConf.experiment2 },
      geneva4: { experiment1: experimentsConf.experiment1, experiment2: experimentsConf.experiment2 }
    };

    serveserverSimulations = {
      geneva1: [_.merge({ state: SIMULATION_STATES.STOPPED }, experimentsConf.experiment1)],
      geneva2: [
        _.merge({ state: SIMULATION_STATES.FAILED }, experimentsConf.experiment1),
        _.merge({ state: SIMULATION_STATES.STOPPED }, experimentsConf.experiment2)
      ],
      geneva3: [_.merge({ state: SIMULATION_STATES.INITIALIZED }, experimentsConf.experiment1)],
      geneva4: [_.merge({ contextId: CTX_ID, state: SIMULATION_STATES.CREATED }, experimentsConf.experiment2)],
    };

    serversStatus = {
      geneva1: 'OK',
      geneva2: 'OK',
      geneva3: 'OK'
    };

  });

  it('should return the correct list of experiments', function () {

    //mock http responses
    _.forOwn(serverExperiments, function (exp, server) {
      nock(BASE_URL + '/' + server)
        .get('/experiment')
        .reply(200, { 'data': serverExperiments[server] });

      nock(BASE_URL + '/' + server)
        .get('/health/errors')
        .reply(200, { 'state': serversStatus[server] });

      nock(BASE_URL + '/' + server)
        .get('/simulation')
        .reply(200, serveserverSimulations[server]);
    });

    var experiments = serversProxy.getExperiments(config);

    nock.isDone();

    return experiments.should.eventually.deep.equal({
      experiment1: {
        availableServers: ['geneva1', 'geneva2'],
        configuration: { experimentConfiguration: 'experimentConf1' },
        joinableServers: [{
          runningSimulation: {
            experimentConfiguration: 'experimentConf1',
            state: 'initialized'
          },
          server: 'geneva3'
        }]
      },
      experiment2: {
        availableServers: ['geneva2'],
        configuration: { experimentConfiguration: 'experimentConf2' },
        joinableServers: [{
          runningSimulation: {
            contextId: 'ctxId',
            experimentConfiguration: 'experimentConf2',
            state: 'created'
          },
          server: 'geneva4'
        }]
      }
    }
    );
  });
});

