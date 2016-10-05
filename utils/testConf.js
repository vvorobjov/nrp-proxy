var _ = require('lodash');
var nock = require('nock');
var sinon = require('sinon');

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

var SERVERS = ['geneva1', 'geneva2', 'geneva3', 'geneva4'];

var URL = 'http://localhost';
var CLIENT_ID = 'CLIENT_ID';
var CLIENT_SECRET = 'CLIENT_SECRET';

var config = {
  auth: {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    url: URL,
    deactivate: false
  },
  servers: {}
};

var emptyConfig = _.cloneDeep(config);

//build server config
SERVERS.forEach(function (server) {
  config.servers[server] = {
    gzweb: {
      assets: BASE_URL + '/' + server,
      'nrp-services': BASE_URL + '/' + server
    }
  };
});

var experimentsConf = {
  experiment1: { experimentConfiguration: 'experimentConf1' },
  experiment2: { experimentConfiguration: 'experimentConf2' },
  experiment3: { experimentConfiguration: 'experimentConf3' }
};

 var serverExperiments = {
      geneva1: { experiment1: experimentsConf.experiment1 },
      geneva2: { experiment1: experimentsConf.experiment1, experiment2: experimentsConf.experiment2 },
      geneva3: { experiment1: experimentsConf.experiment1, experiment2: experimentsConf.experiment2 },
      geneva4: { experiment1: experimentsConf.experiment1, experiment2: experimentsConf.experiment2, experiment3: experimentsConf.experiment3  }
  };

 var serveserverSimulations = {
      geneva1: [_.merge({ state: SIMULATION_STATES.STOPPED }, experimentsConf.experiment1)],
      geneva2: [
        _.merge({ state: SIMULATION_STATES.FAILED }, experimentsConf.experiment1),
        _.merge({ state: SIMULATION_STATES.STOPPED }, experimentsConf.experiment2)
      ],
      geneva3: [_.merge({ state: SIMULATION_STATES.STARTED }, experimentsConf.experiment1)],
      geneva4: [
        _.merge({ contextID: CTX_ID, state: SIMULATION_STATES.CREATED }, experimentsConf.experiment2),
        _.merge({ contextID: CTX_ID, state: SIMULATION_STATES.STOPPED }, experimentsConf.experiment2)
      ],
  };

 var serversStatus = {
      geneva1: 'OK',
      geneva2: 'OK',
      geneva3: 'OK'
  };

  var experimentList = {
      experiment1: {
        availableServers: ['geneva1', 'geneva2'],
        configuration: { experimentConfiguration: 'experimentConf1' },
        joinableServers: [{
          runningSimulation: {
            experimentConfiguration: 'experimentConf1',
            state: 'started'
          },
          server: 'geneva3'
        }]
      },
      experiment2: {
        availableServers: ['geneva2'],
        configuration: { experimentConfiguration: 'experimentConf2' },
        joinableServers: [{
          runningSimulation: {
            contextID: 'ctxId',
            experimentConfiguration: 'experimentConf2',
            state: 'created'
          },
          server: 'geneva4'
        }]
      },
      experiment3: {
        availableServers: [],
        configuration: { experimentConfiguration: 'experimentConf3' },
        joinableServers: []
      }
    };

    var experimentListNoCTXID = {
      experiment1: {
        availableServers: ['geneva1', 'geneva2'],
        configuration: { experimentConfiguration: 'experimentConf1' },
        joinableServers: [{
          runningSimulation: {
            contextID: null,
            experimentConfiguration: 'experimentConf1',
            state: 'started'
          },
          server: 'geneva3'
        }]
      },
      experiment2: {
        availableServers: ['geneva2'],
        configuration: { experimentConfiguration: 'experimentConf2' },
        joinableServers: [{
          runningSimulation: {
            contextID: null,
            experimentConfiguration: 'experimentConf2',
            state: 'created'
          },
          server: 'geneva4'
        }]
      },
      experiment3: {
        availableServers: [],
        configuration: { experimentConfiguration: 'experimentConf3' },
        joinableServers: []
      }
    };

var mockResponses = function () {
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
};

var mockNonJsonResponses = function () {
  _.forOwn(serverExperiments, function (exp, server) {
      nock(BASE_URL + '/' + server)
        .get('/experiment')
        .reply(200, 'experiments');

      nock(BASE_URL + '/' + server)
        .get('/health/errors')
        .reply(200, 'errors');

      nock(BASE_URL + '/' + server)
        .get('/simulation')
        .reply(200, 'simulation');
  });
};

var mockFailedResponses = function () {
  _.forOwn(serverExperiments, function (exp, server) {
      nock(BASE_URL + '/' + server)
        .get('/experiment')
        .reply(500, {});

      nock(BASE_URL + '/' + server)
        .get('/health/errors')
        .reply(500, {});

      nock(BASE_URL + '/' + server)
        .get('/simulation')
        .reply(500, {});
    });
}

var mockImageResponses = function () {
  _.forOwn(experimentList, function (expDetails, exp) {
    expDetails['availableServers'].forEach(function (server) {
      nock(BASE_URL + '/' + server)
        .get('/experiment/' + exp + '/preview')
        .reply(200, {'image_as_base64': 'image'});
    });
  });
};

var mockFailedImageResponse = function () {
  _.forOwn(experimentList, function (expDetails, exp) {
    expDetails['availableServers'].forEach(function (server) {
      nock(BASE_URL + '/' + server)
        .get('/experiment/' + exp + '/preview')
        .replyWithError('An Error occurred');
    });
  });
};

var consoleMock = {
    'log': function () {},
    'error': function () {}
};

var mockSuccessfulOidcResponse = function () {
  nock(URL)
      .post('/token')
      .reply(200, { 'access_token': 'testToken' });
}

var mockFailedOidcResponse = function () {
  nock(URL)
      .post('/token')
      .reply(500, {});
}

var mockNonJsonOidcResponse = function () {
  nock(URL)
      .post('/token')
      .reply(200, 'OK!');
}

module.exports = {
  config: config,
  CTX_ID: CTX_ID,
  SERVERS: SERVERS,
  experimentsConf: experimentsConf,
  experimentList: experimentList,
  experimentListNoCTXID: experimentListNoCTXID,
  serveserverSimulations: serveserverSimulations,
  mockImageResponses: mockImageResponses,
  consoleMock: consoleMock,
  mockSuccessfulOidcResponse: mockSuccessfulOidcResponse,
  mockFailedOidcResponse: mockFailedOidcResponse,
  mockNonJsonOidcResponse: mockNonJsonOidcResponse,
  mockFailedImageResponse: mockFailedImageResponse,
  mockNonJsonResponses: mockNonJsonResponses,
  mockFailedResponses: mockFailedResponses,
  mockResponses: mockResponses
}