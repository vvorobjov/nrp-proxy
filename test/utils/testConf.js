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

const SIMULATION_STATES = {
  CREATED: 'created',
  STARTED: 'started',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  STOPPED: 'stopped'
};

var CTX_ID = 'ctxId',
  EXPERIMENT_ID = 'experimentId',
  BASE_URL = 'http://localhost',
  BASE_INTERNAL_URL = 'http://10.1.1.96';

var SERVERS_SIM = ['geneva1', 'geneva2', 'geneva3', 'geneva4'];

const SERVERS_FREE = ['geneva1', 'geneva2', 'geneva5free', 'geneva6free'];

const SERVERS_DOWN = ['geneva7down', 'geneva8down', 'geneva9down'];

const SERVERS_UP = [...new Set(SERVERS_SIM.concat(SERVERS_FREE))];

const SERVERS = [...new Set(SERVERS_SIM.concat(SERVERS_FREE, SERVERS_DOWN))];

var URL = 'http://localhost';
var CLIENT_ID = 'CLIENT_ID';
var CLIENT_SECRET = 'CLIENT_SECRET';

var config = {
  nrpVersion: '4.1.0',
  refreshInterval: 5000,
  auth: {
    renewInternal: 0,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    url: URL,
    deactivate: false
  },
  modelsPath: 'modelsPath',
  templatesPath: 'test',
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
  templatesPath: 'test',
  servers: {
    genevaInternalIp: {
      internalIp: BASE_INTERNAL_URL + '/' + 'genevaInternalIp',
      'nrp-services': BASE_URL + '/' + 'genevaInternalIp'
    }
  }
};

//build server config
SERVERS.forEach(function(server) {
  config.servers[server] = {
    'nrp-services': BASE_URL + '/' + server
  };
});

var experimentsConf = {
  experiment1: { experimentId: 'experimentConf1' },
  experiment2: { experimentId: 'experimentConf2' },
  experiment3: { experimentId: 'experimentConf3' }
};

var serverSimulations = {
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
  ],
  geneva5free: [],
  geneva6free: []
};

var serverSimulationsInternalIp = {
  genevaInternalIp: [
    _.merge({ state: SIMULATION_STATES.STARTED }, experimentsConf.experiment1)
  ]
};

var experimentList = {
  experiment1: {
    configuration: {
      experimentId: 'experimentConf1',
      thumbnail: 'test.png',
      path: 'data/experiments/experiment1'
    },
    joinableServers: [
      {
        runningSimulation: {
          experimentId: 'experimentConf1',
          state: 'started'
        },
        server: 'geneva3'
      },
      {
        'nrp-services': 'http://localhost/genevaInternalIp',
        id: 'genevaInternalIp'
      }
    ]
  },
  experiment2: {
    configuration: { experimentId: 'experimentConf2' },
    joinableServers: [
      {
        runningSimulation: {
          contextID: 'ctxId',
          experimentID: EXPERIMENT_ID,
          experimentId: 'experimentConf2',
          state: 'created'
        },
        server: 'geneva4'
      }
    ]
  },
  experiment3: {
    configuration: { experimentId: 'experimentConf3' },
    joinableServers: []
  }
};

var experimentListNoCTXID = {
  experiment1: {
    configuration: { experimentId: 'experimentConf1' },
    joinableServers: [
      {
        runningSimulation: {
          contextID: null,
          experimentId: 'experimentConf1',
          state: 'started'
        },
        server: 'geneva3'
      }
    ]
  },
  experiment2: {
    configuration: { experimentId: 'experimentConf2' },
    joinableServers: [
      {
        runningSimulation: {
          contextID: null,
          experimentId: 'experimentConf2',
          state: 'created'
        },
        server: 'geneva4'
      }
    ]
  },
  experiment3: {
    configuration: { experimentId: 'experimentConf3' },
    joinableServers: []
  }
};

var mockResponses = function() {
  SERVERS_UP.forEach(server => {
    nock(BASE_URL + '/' + server)
      .get('/simulation')
      .reply(200, serverSimulations[server]);
  });

  SERVERS_DOWN.forEach(server => {
    nock(BASE_URL + '/' + server)
      .get('/simulation')
      .replyWithError('Server not available');
  });
};

var mockResponsesInternalIp = function() {
  _.forOwn(serverSimulationsInternalIp, function(exp, server) {
    nock(BASE_INTERNAL_URL + '/' + server)
      .get('/simulation')
      .reply(200, serverSimulationsInternalIp[server]);
  });
};

var mockNonJsonResponses = function() {
  SERVERS_UP.forEach(server => {
    nock(BASE_URL + '/' + server)
      .get('/simulation')
      .reply(200, 'simulation');
  });

  SERVERS_DOWN.forEach(server => {
    nock(BASE_URL + '/' + server)
      .get('/simulation')
      .replyWithError('Server not available');
  });
};

var mockFailedResponses = function() {
  SERVERS.forEach(server => {
    nock(BASE_URL + '/' + server)
      .get('/simulation')
      .reply(500, {});
  });
};

var mockImageResponses = function() {
  _.forOwn(experimentList, function(expDetails, exp) {
    expDetails.availableServers.forEach(function(server) {
      nock(BASE_URL + '/' + server.id)
        .get('/experiment/' + exp + '/preview')
        .reply(200, { image_as_base64: 'image' });
    });
  });
};

var mockFailedImageResponse = function() {
  _.forOwn(experimentList, function(expDetails, exp) {
    expDetails.availableServers.forEach(function(server) {
      nock(BASE_URL + '/' + server.id)
        .get('/experiment/' + exp + '/preview')
        .replyWithError('An Error occurred');
    });
  });
};

var consoleMock = {
  log: function() {},
  error: function() {},
  warn: function() {},
  info: function() {},
  debug: function() {}
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
  SERVERS_DOWN,
  SERVERS_UP,
  SERVERS_FREE,
  experimentsConf: experimentsConf,
  experimentList: experimentList,
  experimentListNoCTXID: experimentListNoCTXID,
  serverSimulations: serverSimulations,
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
