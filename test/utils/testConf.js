/**---LICENSE-BEGIN - DO NOT CHANGE OR MOVE THIS HEADER
 * This file is part of the Neurorobotics Platform software
 * Copyright (C) 2014,2015,2016,2017 Human Brain Project
 * https://www.humanbrainproject.eu
 *
 * The Human Brain Project is a European Commission funded project
 * in the frame of the Horizon2020 FET Flagship plan.
 * http://ec.europa.eu/programmes/horizon2020/en/h2020-section/fet-flagships
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 * ---LICENSE-END**/
var _ = require('lodash');
var nock = require('nock');

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
  EXPERIMENT_ID = 'experimentId',
  BASE_URL = 'http://localhost',
  BASE_INTERNAL_URL = 'http://10.1.1.96';

var SERVERS = [
  'geneva1',
  'geneva2',
  'geneva3',
  'geneva4',
  'geneva5',
  'geneva6'
];

var URL = 'http://localhost';
var CLIENT_ID = 'CLIENT_ID';
var CLIENT_SECRET = 'CLIENT_SECRET';

var config = {
  refreshInterval: 5000,
  auth: {
    renewInternal: 0,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    url: URL,
    deactivate: false
  },
  modelsPath: 'modelsPath',
  experimentsPath: 'test',
  servers: {},
  'daint-cscs': {
    job_url: 'job_url',
    job_file_location: 'job_file_location'
  }
};

var configInternalIp = {
  refreshInterval: 5000,
  auth: {
    renewInternal: 0,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    url: URL,
    deactivate: false
  },
  modelsPath: 'modelsPath',
  experimentsPath: 'test',
  servers: {
    genevaInternalIp: {
      internalIp: BASE_INTERNAL_URL + '/' + 'genevaInternalIp',
      gzweb: {
        assets: BASE_URL + '/' + 'genevaInternalIp',
        'nrp-services': BASE_URL + '/' + 'genevaInternalIp'
      }
    }
  }
};

//build server config
SERVERS.forEach(function(server) {
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
  geneva2: {
    experiment1: experimentsConf.experiment1,
    experiment2: experimentsConf.experiment2
  },
  geneva3: {
    experiment1: experimentsConf.experiment1,
    experiment2: experimentsConf.experiment2
  },
  geneva4: {
    experiment1: experimentsConf.experiment1,
    experiment2: experimentsConf.experiment2,
    experiment3: experimentsConf.experiment3
  },
  genevaInternalIp: { experiment1: experimentsConf.experiment1 }
};

var serverExperimentsInternalIp = {
  genevaInternalIp: { experiment1: experimentsConf.experiment1 }
};

var serveserverSimulations = {
  geneva1: [
    _.merge({ state: SIMULATION_STATES.STOPPED }, experimentsConf.experiment1)
  ],
  geneva2: [
    _.merge({ state: SIMULATION_STATES.FAILED }, experimentsConf.experiment1),
    _.merge({ state: SIMULATION_STATES.STOPPED }, experimentsConf.experiment2)
  ],
  geneva3: [
    _.merge({ state: SIMULATION_STATES.STARTED }, experimentsConf.experiment1)
  ],
  geneva4: [
    _.merge(
      {
        contextID: CTX_ID,
        experimentID: EXPERIMENT_ID,
        state: SIMULATION_STATES.CREATED
      },
      experimentsConf.experiment2
    ),
    _.merge(
      {
        contextID: CTX_ID,
        experimentID: EXPERIMENT_ID,
        state: SIMULATION_STATES.STOPPED
      },
      experimentsConf.experiment2
    )
  ]
};

var serveserverSimulationsInternalIp = {
  genevaInternalIp: [
    _.merge({ state: SIMULATION_STATES.STARTED }, experimentsConf.experiment1)
  ]
};

var serversStatus = {
  geneva1: 'OK',
  geneva2: 'OK',
  geneva3: 'OK'
};

var serversStatusInternalIp = {
  genevaInternalIp: 'OK'
};

var experimentList = {
  experiment1: {
    availableServers: [
      {
        gzweb: {
          assets: 'http://localhost/geneva1',
          'nrp-services': 'http://localhost/geneva1'
        },
        id: 'geneva1'
      },
      {
        gzweb: {
          assets: 'http://localhost/geneva2',
          'nrp-services': 'http://localhost/geneva2'
        },
        id: 'geneva2'
      }
    ],
    downServers: [
      {
        gzweb: {
          assets: 'http://localhost/geneva5',
          'nrp-services': 'http://localhost/geneva5'
        },
        id: 'geneva5'
      },
      {
        gzweb: {
          assets: 'http://localhost/geneva6',
          'nrp-services': 'http://localhost/geneva6'
        },
        id: 'geneva6'
      }
    ],
    configuration: {
      experimentConfiguration: 'experimentConf1',
      thumbnail: 'test.png',
      path: 'data/experiments/experiment1'
    },
    joinableServers: [
      {
        runningSimulation: {
          experimentConfiguration: 'experimentConf1',
          state: 'started'
        },
        server: 'geneva3'
      },
      {
        gzweb: {
          assets: 'http://10.1.1.96/genevaInternalIp',
          'nrp-services': 'http://localhost/genevaInternalIp'
        },
        id: 'genevaInternalIp'
      }
    ]
  },
  experiment2: {
    availableServers: [
      {
        gzweb: {
          assets: 'http://localhost/geneva2',
          'nrp-services': 'http://localhost/geneva2'
        },
        id: 'geneva2'
      }
    ],
    configuration: { experimentConfiguration: 'experimentConf2' },
    joinableServers: [
      {
        runningSimulation: {
          contextID: 'ctxId',
          experimentID: EXPERIMENT_ID,
          experimentConfiguration: 'experimentConf2',
          state: 'created'
        },
        server: 'geneva4'
      }
    ]
  },
  experiment3: {
    availableServers: [],
    configuration: { experimentConfiguration: 'experimentConf3' },
    joinableServers: []
  }
};

var experimentListNoCTXID = {
  experiment1: {
    availableServers: [
      {
        gzweb: {
          assets: 'http://localhost/geneva1',
          'nrp-services': 'http://localhost/geneva1'
        },
        id: 'geneva1'
      },
      {
        gzweb: {
          assets: 'http://localhost/geneva2',
          'nrp-services': 'http://localhost/geneva2'
        },
        id: 'geneva2'
      }
    ],
    configuration: { experimentConfiguration: 'experimentConf1' },
    joinableServers: [
      {
        runningSimulation: {
          contextID: null,
          experimentConfiguration: 'experimentConf1',
          state: 'started'
        },
        server: 'geneva3'
      }
    ]
  },
  experiment2: {
    availableServers: [
      {
        gzweb: {
          assets: 'http://localhost/geneva2',
          'nrp-services': 'http://localhost/geneva2'
        },
        id: 'geneva2'
      }
    ],
    configuration: { experimentConfiguration: 'experimentConf2' },
    joinableServers: [
      {
        runningSimulation: {
          contextID: null,
          experimentConfiguration: 'experimentConf2',
          state: 'created'
        },
        server: 'geneva4'
      }
    ]
  },
  experiment3: {
    availableServers: [],
    configuration: { experimentConfiguration: 'experimentConf3' },
    joinableServers: []
  }
};

var mockResponses = function() {
  _.forOwn(serverExperiments, function(exp, server) {
    nock(BASE_URL + '/' + server)
      .get('/experiment')
      .reply(200, { data: serverExperiments[server] });

    nock(BASE_URL + '/' + server)
      .get('/health/errors')
      .reply(200, { state: serversStatus[server] });

    nock(BASE_URL + '/' + server)
      .get('/simulation')
      .reply(200, serveserverSimulations[server]);
  });
};

var mockResponsesInternalIp = function() {
  _.forOwn(serverExperimentsInternalIp, function(exp, server) {
    nock(BASE_INTERNAL_URL + '/' + server)
      .get('/experiment')
      .reply(200, { data: serverExperimentsInternalIp[server] });

    nock(BASE_INTERNAL_URL + '/' + server)
      .get('/health/errors')
      .reply(200, { state: serversStatusInternalIp[server] });

    nock(BASE_INTERNAL_URL + '/' + server)
      .get('/simulation')
      .reply(200, serveserverSimulationsInternalIp[server]);
  });
};

var mockNonJsonResponses = function() {
  _.forOwn(serverExperiments, function(exp, server) {
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

var mockFailedResponses = function() {
  _.forOwn(serverExperiments, function(exp, server) {
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
};

var mockImageResponses = function() {
  _.forOwn(experimentList, function(expDetails, exp) {
    expDetails['availableServers'].forEach(function(server) {
      nock(BASE_URL + '/' + server.id)
        .get('/experiment/' + exp + '/preview')
        .reply(200, { image_as_base64: 'image' });
    });
  });
};

var mockFailedImageResponse = function() {
  _.forOwn(experimentList, function(expDetails, exp) {
    expDetails['availableServers'].forEach(function(server) {
      nock(BASE_URL + '/' + server.id)
        .get('/experiment/' + exp + '/preview')
        .replyWithError('An Error occurred');
    });
  });
};

var consoleMock = {
  log: function() {},
  error: function() {},
  warn: function() {}
};

var mockSuccessfulOidcResponse = function() {
  nock(URL)
    .post('/protocol/openid-connect/token')
    .reply(200, { access_token: 'testToken' });
};

var mockFailedOidcResponse = function() {
  nock(URL)
    .post('/protocol/openid-connect/token')
    .reply(500, {});
};

var mockNonJsonOidcResponse = function() {
  nock(URL)
    .post('/protocol/openid-connect/token')
    .reply(200, 'OK!');
};

module.exports = {
  config: config,
  configInternalIp: configInternalIp,
  EXPERIMENT_ID: EXPERIMENT_ID,
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
  mockResponses: mockResponses,
  mockResponsesInternalIp: mockResponsesInternalIp
};
