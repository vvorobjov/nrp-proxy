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

var _ = require('lodash'),
  q = require('q');

var ModelsService = require('./modelsService.js'),
  ExperimentsService = require('./experimentsService.js'),
  oidcAuthenticator = require('./oidcAuthenticator.js'),
  serversProxy = require('./serversProxy.js');

var experimentList = {};
var simulationList = [];
var availableServers = [];

var configuration, modelsService, experimentsService;

function initialize(config) {
  reloadConfiguration(config)
    .then(updateExperimentList)
    .catch(err => console.error(err));
}

function reloadConfiguration(config) {
  configuration = config;
  if (!configuration)
    throw 'Proxy requestHandler.reloadConfiguration: configuration required';

  ['refreshInterval', 'modelsPath', 'experimentsPath'].forEach(prop => {
    if (!configuration[prop])
      throw `Configuration key '${prop}' is missing in the config file. Please update`;
  });

  console.log(
    'Polling Backend Servers for Experiments, Health & Running Simulations every',
    configuration.refreshInterval,
    'ms.'
  );

  oidcAuthenticator.configure(configuration.auth);

  _.forEach(configuration.servers, (conf, id) => (conf.id = id));

  modelsService = new ModelsService(configuration.modelsPath);
  modelsService.loadModels();

  experimentsService = new ExperimentsService(configuration.experimentsPath);
  return experimentsService.loadExperiments().then(experiments => {
    experimentList = _(experiments)
      .map(exp => [
        exp.id,
        {
          configuration: exp,
          joinableServers: []
        }
      ])
      .fromPairs()
      .value();
  });
}

var filterJoinableExperimentByContext = function(experiments) {
  return _.mapValues(experiments, function(originalExperiment) {
    var exp = _.cloneDeep(originalExperiment);
    if (exp && exp.joinableServers) {
      exp.joinableServers = exp.joinableServers.filter(function(joinable) {
        return !joinable.runningSimulation.contextID;
      });
    }
    return exp;
  });
};

function updateExperimentList() {
  oidcAuthenticator
    .getToken()
    .then(serversProxy.setToken)
    .then(() => serversProxy.getExperimentsAndSimulations(configuration))
    .then(([joinableServers, simulations, serversAvailable]) => {
      simulationList = simulations;
      availableServers = serversAvailable;
      //build experimentList with exp config + joinable servers + available servers
      _.forOwn(experimentList, exp => {
        exp.joinableServers =
          joinableServers[exp.configuration.experimentConfiguration] || [];
      });
    })
    .fail(err =>
      console.error('Polling Error. Failed to get experiments: ', err)
    )
    .finally(() =>
      setTimeout(updateExperimentList, configuration.refreshInterval)
    );
}

function getServer(serverId) {
  if (configuration.servers[serverId])
    return q.resolve(configuration.servers[serverId]);

  console.error('Wrong Server ID');
  return q.reject("'serverId' not found\n");
}

function getJoinableServers(experimentId) {
  var deferred = q.defer();
  var contextSims = [];
  _.forOwn(simulationList, function(serverSimulations, serverId) {
    serverSimulations.forEach(function(simulation) {
      if (
        simulation.experimentID === experimentId &&
        serversProxy.RUNNING_SIMULATION_STATES.indexOf(simulation.state) !== -1
      ) {
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

function getAvailableServers() {
  return q.resolve(availableServers);
}

function getExperiments() {
  return q.resolve(filterJoinableExperimentByContext(experimentList));
}

function getExperimentImageFile(experimentId) {
  if (!experimentList[experimentId]) throw ('No experiment id: ', experimentId);
  let experiment = experimentList[experimentId].configuration;
  return q.resolve(
    experimentsService.getExperimentFilePath(
      experiment.path,
      experiment.thumbnail
    )
  );
}

function getModels(modelType) {
  return modelsService && modelsService.getModels(modelType);
}

module.exports = {
  reloadConfiguration,
  initialize,
  getServer,
  getExperiments,
  getExperimentImageFile,
  getAvailableServers,
  getJoinableServers,
  filterJoinableExperimentByContext,
  getModels
};
