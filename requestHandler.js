'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var q = require('q');

var experimentList = {};

var oidcToken;
var configuration;

var oidcAuthenticator = require('./oidcAuthenticator.js');
var serversProxy = require('./serversProxy.js');

// path.resolve is required because the current directory is recreated regularly by puppet
// and when that happens fs.readFileSync fails if using a relative path
var CONFIG_FILE = path.resolve('./config.json');

function reloadConfigFile() {
  try {
    configuration = JSON.parse(fs.readFileSync(CONFIG_FILE));
  }
  catch (err) {
    if (err.code === 'ENOENT' && typeof configuration === 'undefined') {
      console.log('config.json not found! Please create a config.json from config.json.sample and run again!');
    }
    console.error(err);
  }
}

reloadConfigFile();

var filterJoinableExperimentByContext = function (experiments, contextId) {
  return _.mapValues(experiments, function (originalExperiment) {
    var exp = _.cloneDeep(originalExperiment);
    if (exp && exp.joinableServers) {
      exp.joinableServers = exp.joinableServers.filter(function (joinable) {
        return joinable.runningSimulation.contextID === contextId;
      });
    }
    return exp;
  });
};

function updateExperimentList(updateInterval) {
  if (!configuration.auth.deactivate) {
    oidcToken = oidcAuthenticator(configuration.auth.url)
      .getToken(configuration.auth.clientId, configuration.auth.clientSecret)
      .then(serversProxy.setToken);
  } else {
    oidcToken = q(false);
  }
  oidcToken.then(_.partial(serversProxy.getExperiments, configuration))
    .then(function (experiments) {
      experimentList = experiments;
    })
    .fail(function (err) {
      console.error('Polling Error. Failed to get experiments: ', err);
    })
    .finally(function () {
      setTimeout(function() {
        updateExperimentList(updateInterval);
      }, updateInterval);
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

function getJoinableServers(clientIP, experimentId) {
  console.log('[FRONTEND REQUEST from', clientIP, '] GET Joinable Servers. ExperimentID:', experimentId);
  var deferred = q.defer();
  if(experimentList[experimentId]) {
    deferred.resolve(experimentList[experimentId].joinableServers);
  }
  else {
    console.error('Wrong Experiment ID');
    deferred.reject('experimentId: \'' + experimentId + '\' not found\n');
  }
  return deferred.promise;
}

function getAvailableServers(clientIP, experimentId) {
  console.log('[FRONTEND REQUEST from', clientIP, '] GET Available Servers. ExperimentID:', experimentId);
  var deferred = q.defer();
  if(experimentList[experimentId]) {
    deferred.resolve(experimentList[experimentId].availableServers);
  } else {
    console.error('Wrong Experiment ID');
    deferred.reject('experimentId: \'' + experimentId + '\' not found\n');
  }
  return deferred.promise;
}

function getExperiments(clientIP, experimentId, contextId) {
  console.log('[FRONTEND REQUEST from', clientIP, '] GET Experiments');
  var deferred = q.defer();
  if (experimentId) {
    if (!contextId) {
      deferred.reject('\'contextId\' query string missing\n');
      console.error('contextId query string missing');
    } else {
      deferred.resolve(filterJoinableExperimentByContext(_.pick(experimentList, experimentId), contextId));
    }
  } else {
    deferred.resolve(filterJoinableExperimentByContext(experimentList, null));
  }
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
  configuration: configuration,
  reloadConfigFile: reloadConfigFile,
  updateExperimentList: updateExperimentList,
  getServer: getServer,
  getExperiments: getExperiments,
  getExperimentImage: getExperimentImage,
  getAvailableServers: getAvailableServers,
  getJoinableServers: getJoinableServers,
  experimentList: experimentList,
  filterJoinableExperimentByContext: filterJoinableExperimentByContext
};