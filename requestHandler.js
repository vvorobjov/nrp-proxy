/**---LICENSE-BEGIN - DO NOT CHANGE OR MOVE THIS HEADER
 * This file is part of the Neurorobotics Platform software
 * Copyright (C) 2014,2015,2016,2017 Human Brain Project
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
 * ---LICENSE-END **/
'use strict';

var fs = require('fs'),
  path = require('path'),
  _ = require('lodash'),
  q = require('q');

var ModelsService = require('./modelsService.js'),
  oidcAuthenticator = require('./oidcAuthenticator.js'),
  serversProxy = require('./serversProxy.js');

var experimentList = {};
var simulationList = [];
var availableServers = [];

var oidcToken,
  configuration,
  modelsService;

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

    let modelsPath = configuration.modelsPath.replace(/\$([A-Za-z]*)/g, (m, v)=>process.env[v]);
    modelsService = new ModelsService(modelsPath);
    modelsService.loadModels();
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
      availableServers = experimentData[2];
      //make sure images are preloaded
      _(experimentList).forEach((exp, expId) => serversProxy.getExperimentImage(expId, experimentList, configuration));
    })
    .fail(function (err) {
      console.error('Polling Error. Failed to get experiments: ', err);
    })
    .finally(function() {
      setTimeout(function() {
        updateExperimentList();
      }, configuration.refreshInterval);
    });
}

function getServer(serverId) {
  if (configuration.servers[serverId])
    return q.resolve(configuration.servers[serverId]);

  console.error('Wrong Server ID');
  return q.reject('\'serverId\' not found\n');
}

function getJoinableServers(contextId) {
  var deferred = q.defer();
  var contextSims = [];
  _.forOwn(simulationList, function(serverSimulations, serverId) {
    serverSimulations.forEach(function(simulation) {
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

function getAvailableServers(experimentId) {
  if (!experimentId)
    return q.resolve(availableServers);
  if (experimentList[experimentId])
    return q.resolve(experimentList[experimentId].availableServers);
  console.error('Wrong Experiment ID');
  return q.reject('experimentId: \'' + experimentId + '\' not found\n');
}

function getExperiments() {
  return q.resolve(filterJoinableExperimentByContext(experimentList));
}

function getExperimentImage(experiments) {
  experiments = experiments.split(',');
  return q.all(experiments.map(function(exp) {
    return serversProxy.getExperimentImage(exp, experimentList, configuration);
  }))
    .then(_.fromPairs)
    .catch(function(err) {
      console.error('Failed to get experiments images: ', err);
    });
}

function getModels(modelType) {
  return modelsService && modelsService.getModels(modelType);
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
  filterJoinableExperimentByContext: filterJoinableExperimentByContext,
  getModels: getModels
};
