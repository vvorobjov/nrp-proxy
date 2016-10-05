'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var q = require('q');

var experimentList = {};
var simulationList = [];

var oidcToken;
var configuration;

var oidcAuthenticator = require('./oidcAuthenticator.js');
var serversProxy = require('./serversProxy.js');

// path.resolve is required because the current directory is recreated regularly by puppet
// and when that happens fs.readFileSync fails if using a relative path
var CONFIG_FILE = path.resolve('./config.json');

function initialize() {
  reloadConfigFile();
  updateExperimentList();
}

function reloadConfigFile() {
  try {
    configuration = JSON.parse(fs.readFileSync(CONFIG_FILE));

    if (!configuration.refreshInterval)
      throw 'Configuration key \'refreshInterval\' is missing in the config file. Please update';

    console.log('Polling Backend Servers for Experiments, Health & Running Simulations every',
      configuration.refreshInterval, 'ms.');

    oidcAuthenticator.configure(configuration.auth);
  }
  catch (err) {
    if (err.code === 'ENOENT' && typeof configuration === 'undefined') {
      console.log('config.json not found! Please create a config.json from config.json.sample and run again!');
    }
    console.error(err);
  }
}

var filterJoinableExperimentByContext = function (experiments) {
  return _.mapValues(experiments, function (originalExperiment) {
    var exp = _.cloneDeep(originalExperiment);
    if (exp && exp.joinableServers) {
      exp.joinableServers = exp.joinableServers.filter(function (joinable) {
        return joinable.runningSimulation.contextID === null;
      });
    }
    return exp;
  });
};

function updateExperimentList() {
  oidcToken = oidcAuthenticator.getToken().then(serversProxy.setToken);

  oidcToken.then(_.partial(serversProxy.getExperimentsAndSimulations, configuration))
    .then(function (experimentData) {
      experimentList = experimentData[0];
      simulationList = experimentData[1];
    })
    .fail(function (err) {
      console.error('Polling Error. Failed to get experiments: ', err);
    })
    .finally(function () {
      setTimeout(function () {
        updateExperimentList();
      }, configuration.refreshInterval);
    });
}

function getServer(clientIP, serverId) {
  console.log('[FRONTEND REQUEST from', clientIP, '] GET Server. ServerID:', serverId);
  var deferred = q.defer();
  if (configuration.servers[serverId]) {
    deferred.resolve(configuration.servers[serverId]);
  } else {
    console.error('Wrong Server ID');
    deferred.reject('\'serverId\' not found\n');
  }
  return deferred.promise;
}

function getJoinableServers(clientIP, contextId) {
  console.log('[FRONTEND REQUEST from', clientIP, '] GET Joinable Servers. ContextID:', contextId);
  var deferred = q.defer();
  var contextSims = [];
  _.forOwn(simulationList, function (serverSimulations, serverId) {
    serverSimulations.forEach(function (simulation) {
      if (simulation.contextID === contextId &&
        serversProxy.RUNNING_SIMULATION_STATES.indexOf(simulation.state) !== -1) {
        contextSims.push({
          server: serverId,
          runningSimulation: simulation
        });
      }
    });
  });
  deferred.resolve(contextSims);
  return deferred.promise;
}

function getAvailableServers(clientIP, experimentId) {
  console.log('[FRONTEND REQUEST from', clientIP, '] GET Available Servers. ExperimentID:', experimentId);
  var deferred = q.defer();
  if (experimentList[experimentId]) {
    deferred.resolve(experimentList[experimentId].availableServers);
  } else {
    console.error('Wrong Experiment ID');
    deferred.reject('experimentId: \'' + experimentId + '\' not found\n');
  }
  return deferred.promise;
}

function getExperiments(clientIP) {
  console.log('[FRONTEND REQUEST from', clientIP, '] GET Experiments');
  var deferred = q.defer();
  deferred.resolve(filterJoinableExperimentByContext(experimentList));
  return deferred.promise;
}

function getExperimentImage(clientIP, experiments) {
  console.log('[FRONTEND REQUEST from', clientIP, '] GET Experiment Images');
  var deferred = q.defer();
  experiments = experiments.split(',');
  q.all(experiments.map(function (exp) {
    return serversProxy.getExperimentImage(exp, experimentList, configuration);
  }))
    .then(_.fromPairs)
    .then(function (images) {
      deferred.resolve(images);
    }).catch(function (err) {
      console.error('Failed to get experiments images: ', err);
    });
  return deferred.promise;
}

module.exports = {
  CONFIG_FILE: CONFIG_FILE,
  getConfiguration: function () { return configuration; },
  reloadConfigFile: reloadConfigFile,
  initialize: initialize,
  getServer: getServer,
  getExperiments: getExperiments,
  getExperimentImage: getExperimentImage,
  getAvailableServers: getAvailableServers,
  getJoinableServers: getJoinableServers,
  experimentList: experimentList,
  filterJoinableExperimentByContext: filterJoinableExperimentByContext
};
