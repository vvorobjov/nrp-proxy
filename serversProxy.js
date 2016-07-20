var request = require('request');
var q = require('q');
var _ = require('lodash');

var SERVER_URLS = {
  EXPERIMENT: '/experiment',
  HEALTH: '/health/errors',
  SIMULATION: '/simulation'
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


var executeServerRequest = function (url, token) {
  var options = {
    method: 'GET',
    url: url,
    headers: { Authorization: 'Bearer ' + token }
  };

  var deferred = q.defer();

  request(options, function (err, res, body) {
    if (err) {
      deferred.reject(new Error(err));
    } else if (res.statusCode < 200 || res.statusCode >= 300) {
      deferred.reject(new Error("Status code: " + res.statusCode + "\n" + body));
    } else {
      try {
        var bodyObj = JSON.parse(body);
        deferred.resolve(bodyObj);
      } catch (e) {
        deferred.reject(new Error(body));
      }
    }
  });

  return deferred.promise;
};

var executeRequestForAllServers = function (configuration, token, urlPostFix) {
  var serversResponses = [];
  _.forOwn(configuration.servers, function (serverConfig, serverId) {
    serversResponses.push(executeServerRequest(serverConfig.gzweb['nrp-services'] + urlPostFix, token)
      .then(function (serverResponse) {
        return [serverId, serverResponse];
      }));
  });
  return q.all(serversResponses);
};

var mergeData = function (responsesData) {
  var data = {
    experiments: responsesData[0],
    health: _.fromPairs(responsesData[1]),
    simulations: _.fromPairs(responsesData[2])
  };

  _.forOwn(data.simulations, function (serverSimulations, serverId) {
    serverSimulations.runningSimulation = serverSimulations.filter(function (s) {
      return RUNNING_SIMULATION_STATES.indexOf(s.state) != -1;
    })[0];
  });

  var mergedData = {};
  data.experiments.forEach(function (expArr) {
    var serverExperiements = expArr[1].data;
    var serverId = expArr[0];
    for (var expId in serverExperiements) {
      var exp = serverExperiements[expId];
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
      else if (runningSimulation.experimentConfiguration === responseExp.configuration.experimentConfiguration) { //server is running this experiment
        responseExp.joinableServers.push({
          server: serverId,
          runningSimulation: runningSimulation
        });
      }
    }
  });
  return mergedData;
};

var getExperiments = function (configuration, authToken) {
  return q.all([
    executeRequestForAllServers(configuration, authToken, SERVER_URLS.EXPERIMENT),
    executeRequestForAllServers(configuration, authToken, SERVER_URLS.HEALTH),
    executeRequestForAllServers(configuration, authToken, SERVER_URLS.SIMULATION)
  ])
    .then(mergeData);
};

module.exports = {
  getExperiments: getExperiments
};