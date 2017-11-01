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
'use strict';

var request = require('request');
var q = require('q');
var _ = require('lodash');
var dateFormat = require('dateformat');
require('log-prefix')(function() {
  return dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss Z');
});

var REQUEST_TIMEOUT = 20 * 1000; //ms

var SERVER_URLS = {
  EXPERIMENT: '/experiment',
  HEALTH: '/health/errors',
  SIMULATION: '/simulation'
};

var HEALTH_STATUS_PRIORITY = {
  OK: 1,
  WARNING: 2,
  CRITICAL: 3
};

var SIMULATION_STATES = {
  CREATED: 'created',
  STARTED: 'started',
  PAUSED: 'paused',
  INITIALIZED: 'initialized',
  HALTED: 'halted',
  FAILED: 'failed',
  STOPPED: 'stopped'
};

var RUNNING_SIMULATION_STATES = [
  SIMULATION_STATES.CREATED,
  SIMULATION_STATES.PAUSED,
  SIMULATION_STATES.STARTED,
  SIMULATION_STATES.INITIALIZED,
  SIMULATION_STATES.HALTED
];

var authToken;
var setToken = function(token) {
  authToken = token;
};

var executeServerRequest = function(url) {
  var options = {
    method: 'GET',
    url: url,
    timeout: REQUEST_TIMEOUT,
    headers: { Authorization: 'Bearer ' + authToken }
  };

  var deferred = q.defer();

  request(options, function(err, res, body) {
    function requestFailed(error) {
      console.error(
        'Failed to execute request ' + options.url + '. ERROR: ' + error
      );
      deferred.reject(error);
    }

    if (err) {
      requestFailed(new Error(err));
    } else if (res.statusCode < 200 || res.statusCode >= 300) {
      requestFailed(new Error('Status code: ' + res.statusCode + '\n' + body));
    } else {
      try {
        var bodyObj = JSON.parse(body);
        deferred.resolve(bodyObj);
      } catch (e) {
        requestFailed(new Error(e));
      }
    }
  });
  return deferred.promise;
};

var executeRequestForAllServers = function(configuration, urlPostFix) {
  var serversResponses = [];
  _.forOwn(configuration.servers, function(serverConfig, serverId) {
    serversResponses.push(
      executeServerRequest(serverConfig.gzweb['nrp-services'] + urlPostFix)
        .then(function(serverResponse) {
          return [serverId, serverResponse];
        })
        .catch(() => [serverId, null])
    );
  });
  return q.all(serversResponses);
};

var mergeData = function(responsesData, configuration) {
  var filterErrors = function(data) {
    return data.filter(function(e) {
      return e[1] && !(e[1].data instanceof Error);
    });
  };
  var data = {
    experiments: filterErrors(responsesData[0]),
    health: _.fromPairs(filterErrors(responsesData[1])),
    simulations: _.fromPairs(filterErrors(responsesData[2]))
  };

  _.forOwn(data.simulations, function(serverSimulations) {
    serverSimulations.runningSimulation = _.find(serverSimulations, function(
      s
    ) {
      return RUNNING_SIMULATION_STATES.indexOf(s.state) !== -1;
    });
  });

  var mergedData = {};
  data.experiments.forEach(function(expArr) {
    var serverExperiments = expArr[1].data;
    var serverId = expArr[0];
    _.forOwn(serverExperiments, function(exp, expId) {
      if (!mergedData[expId]) {
        mergedData[expId] = {
          configuration: exp,
          availableServers: [],
          joinableServers: []
        };
      }
      var responseExp = mergedData[expId];
      var runningSimulation = data.simulations[serverId].runningSimulation;
      if (!runningSimulation) {
        //server is free
        responseExp.availableServers.push(serverId);
      } else if (
        runningSimulation.experimentConfiguration ===
          responseExp.configuration.experimentConfiguration &&
        runningSimulation.state !== SIMULATION_STATES.HALTED
      ) {
        //server is running this experiment
        responseExp.joinableServers.push({
          server: serverId,
          runningSimulation: runningSimulation
        });
      }
    });
  });

  //sort available servers by health
  _.forOwn(mergedData, function(exp) {
    exp.availableServers = _(exp.availableServers)
      .map(s => _.extend({}, configuration.servers[s], { id: s }))
      .sortBy(
        ({ id }) =>
          HEALTH_STATUS_PRIORITY[data.health[id] && data.health[id].state] || 9
      )
      .value();
  });
  return mergedData;
};

var getExperimentsAndSimulations = function(configuration) {
  return q
    .all([
      executeRequestForAllServers(configuration, SERVER_URLS.EXPERIMENT),
      executeRequestForAllServers(configuration, SERVER_URLS.HEALTH),
      executeRequestForAllServers(configuration, SERVER_URLS.SIMULATION)
    ])
    .then(function(response) {
      var availableServers = response[2].filter(function(e) {
        return e[1] && !(e[1].data instanceof Error);
      });
      var availableServerObjects = availableServers
        .filter(
          a =>
            !a[1].filter(a => RUNNING_SIMULATION_STATES.includes(a.state))
              .length
        )
        .map(a => configuration.servers[a[0]]);
      return [
        mergeData(response, configuration),
        _.fromPairs(availableServers),
        availableServerObjects
      ];
    });
};

var getExperimentImage = _.memoize(
  function(experimentId, experiments, configuration) {
    var exp = experiments[experimentId];

    if (!exp) {
      console.error(
        '[GET] Experiment Image: Experiment ID "' +
          experimentId +
          '" does not exist!'
      );
      return q.when([experimentId, null]);
    }

    var firstServer =
      _.head(exp.availableServers) ||
      _.head(_.map(exp.joinableServers, 'server'));
    if (!firstServer) {
      return q.when([experimentId, null]);
    }

    var url = configuration.servers[firstServer.id].gzweb['nrp-services'];
    return q.all([
      experimentId,
      executeServerRequest(
        url + SERVER_URLS.EXPERIMENT + '/' + experimentId + '/preview',
        ''
      )
        .then(function(image) {
          console.log(
            "Image obtained for ExperimentID: '" + experimentId + "'"
          );
          return image['image_as_base64'];
        })
        .catch(function(err) {
          console.error('Failed to load experiment Image: ', err);
          return q.when(null);
        })
    ]);
  },
  function(experimentId) {
    return experimentId;
  }
);

module.exports = {
  setToken: setToken,
  getExperimentsAndSimulations: getExperimentsAndSimulations,
  getExperimentImage: getExperimentImage,
  RUNNING_SIMULATION_STATES: RUNNING_SIMULATION_STATES
};
