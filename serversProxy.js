'use strict';

var request = require('request');
var q = require('q');
var _ = require('lodash');
require('log-prefix')(function() { return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ' ') + '%s'; });

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
var setToken = function (token) {
  authToken = token;
};

var executeServerRequest = function (url) {
  var options = {
    method: 'GET',
    url: url,
    headers: { Authorization: 'Bearer ' + authToken }
  };

  var deferred = q.defer();

  request(options, function (err, res, body) {
    var queryServerError = new Error(err);
    function requestFailed(error) {
      console.error('Failed to execute request ' + options.url + '. ERROR: ' + error);
      deferred.reject(queryServerError);
    }
    if (err) {
      requestFailed(queryServerError);
    } else if (res.statusCode < 200 || res.statusCode >= 300) {
      requestFailed(new Error('Status code: ' + res.statusCode + '\n' + body));
    } else {
      try {
        var bodyObj = JSON.parse(body);
        deferred.resolve(bodyObj);
      } catch (e) {
        requestFailed(new Error(body));
      }
    }
  });
  return deferred.promise;
};

var executeRequestForAllServers = function (configuration, urlPostFix) {
  var serversResponses = [];
  _.forOwn(configuration.servers, function (serverConfig, serverId) {
    serversResponses.push(executeServerRequest(serverConfig.gzweb['nrp-services'] + urlPostFix)
      .then(function (serverResponse) {
        return [serverId, serverResponse];
      }));
  });
  return q.all(serversResponses);
};

var mergeData = function (responsesData) {
  var filterErrors = function (data) {
    return data.filter(function (e) { return !(e[1].data instanceof Error); });
  };
  var data = {
    experiments: filterErrors(responsesData[0]),
    health: _.fromPairs(filterErrors(responsesData[1])),
    simulations: _.fromPairs(filterErrors(responsesData[2]))
  };

  _.forOwn(data.simulations, function (serverSimulations, serverId) {
    serverSimulations.runningSimulation = _.find(serverSimulations, function (s) {
      return RUNNING_SIMULATION_STATES.indexOf(s.state) !== -1;
    });
  });

  var mergedData = {};
  data.experiments.forEach(function (expArr) {
    var serverExperiments = expArr[1].data;
    var serverId = expArr[0];
    _.forOwn(serverExperiments, function (exp, expId) {
      if (!mergedData[expId]) {
        mergedData[expId] = {
          configuration: exp,
          availableServers: [],
          joinableServers: []
        };
      }
      var responseExp = mergedData[expId];
      var runningSimulation = data.simulations[serverId].runningSimulation;
      if (!runningSimulation) { //server is free
        responseExp.availableServers.push(serverId);
      }
      else if (runningSimulation.experimentConfiguration === responseExp.configuration.experimentConfiguration &&
        runningSimulation.state !== SIMULATION_STATES.HALTED) {
        //server is running this experiment
        responseExp.joinableServers.push({
          server: serverId,
          runningSimulation: runningSimulation
        });
      }
    });
  });

  //sort available servers by health
  _.forOwn(mergedData, function (exp) {
    exp.availableServers = _.sortBy(exp.availableServers, function (server) {
      return HEALTH_STATUS_PRIORITY[data.health[server] && data.health[server].state] || 9;
    });
  });
  return mergedData;
};

var getExperiments = function (configuration) {
  return q.all([
    executeRequestForAllServers(configuration, SERVER_URLS.EXPERIMENT),
    executeRequestForAllServers(configuration, SERVER_URLS.HEALTH),
    executeRequestForAllServers(configuration, SERVER_URLS.SIMULATION)
  ])
    .then(mergeData);
};

var getExperimentImage = _.memoize(function (experimentId, experiments, configuration) {
  var exp = experiments[experimentId];
  if (!exp) {
    console.error('[GET] Experiment Image: Experiment ID \"' + experimentId + '\" does not exist!');
    return q.when([experimentId, null]);
  }

  var firstServer = _.head(exp.availableServers) || _.head(_.map(exp.joinableServers, 'server'));
  if (!firstServer) {
    return q.when([experimentId, null]);
  }

  var url = configuration.servers[firstServer].gzweb['nrp-services'];
  return q.all([
    experimentId,
    executeServerRequest(url + SERVER_URLS.EXPERIMENT + '/' + experimentId + '/preview', '')
      .then(function (image) {
        console.log('Image obtained for ExperimentID: \'' + experimentId + '\'');
        return image['image_as_base64'];
      })
      .catch(function (err) {
        console.error('Failed to load experiment Image: ', err);
        return q.when(null);
      })
  ]);
}, function (experimentId) {
  return experimentId;
});

module.exports = {
  setToken: setToken,
  getExperiments: getExperiments,
  getExperimentImage: getExperimentImage
};