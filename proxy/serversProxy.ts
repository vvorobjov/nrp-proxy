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

const request = require('request');
const q = require('q');
const _ = require('lodash');
const dateFormat = require('dateformat');

require('log-prefix')(() => dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss Z'));

const REQUEST_TIMEOUT = 20 * 1000; // ms

const SERVER_URLS = {
  HEALTH: '/health/errors',
  SIMULATION: '/simulation'
};

const HEALTH_STATUS_PRIORITY = {
  OK: 1,
  WARNING: 2,
  CRITICAL: 3,
  DOWN: 9
};

const SIMULATION_STATES = {
  CREATED: 'created',
  STARTED: 'started',
  PAUSED: 'paused',
  INITIALIZED: 'initialized',
  HALTED: 'halted',
  FAILED: 'failed',
  STOPPED: 'stopped'
};

const RUNNING_SIMULATION_STATES = [
  SIMULATION_STATES.CREATED,
  SIMULATION_STATES.PAUSED,
  SIMULATION_STATES.STARTED,
  SIMULATION_STATES.INITIALIZED,
  SIMULATION_STATES.HALTED
];

const STOPPED_SIMULATION_STATES = [
  SIMULATION_STATES.FAILED,
  SIMULATION_STATES.STOPPED
];

let authToken;
const setToken = token => {
  authToken = token;
};

const executeServerRequest = (url: string): Promise<any> => {
  const options = {
    method: 'GET',
    url,
    timeout: REQUEST_TIMEOUT,
    headers: { Authorization: 'Bearer ' + authToken }
  };

  const deferred = q.defer();

  request(options, (err, res, body) => {
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
        const bodyObj = JSON.parse(body);
        deferred.resolve(bodyObj);
      } catch (e) {
        requestFailed(new Error(e));
      }
    }
  });
  return deferred.promise;
};

const executeRequestForAllServers = (configuration, urlPostFix) => {
  const serversResponses: any[] = [];
  _.forOwn(configuration.servers, (serverConfig, serverId) => {
    serversResponses.push(
      executeServerRequest(serverConfig.gzweb['nrp-services'] + urlPostFix)
        .then(serverResponse => {
          return [serverId, serverResponse];
        })
        .catch(() => [serverId, null])
    );
  });
  return q.all(serversResponses);
};

async function getExperimentsAndSimulations(configuration) {
  let [health, simulations] = await q.all([
    executeRequestForAllServers(configuration, SERVER_URLS.HEALTH),
    executeRequestForAllServers(configuration, SERVER_URLS.SIMULATION)
  ]);

  // map to dictionary<server, healthStatus>
  health = _.fromPairs(health);

  // map to dictionary<server, simulationStatus>
  simulations = _.fromPairs(
    simulations.filter(
      simulation => simulation[1] && !(simulation[1].data instanceof Error)
    )
  );

  // set runningSimulation per simulation server
  _.forOwn(simulations, serverSimulations => {
    // Set stoppedSimulations to true only if a reply from the server states that the last running simulation is stopped
    if (serverSimulations.length === 0) {
      serverSimulations.stoppedSimulation = true;
    } else {
      let simRunning = false;
      serverSimulations.forEach(value => {
        if (RUNNING_SIMULATION_STATES.includes(value.state)) {
          simRunning = true;
        }
      });
      serverSimulations.stoppedSimulation = !simRunning;
    }

    serverSimulations.runningSimulation = _.find(serverSimulations, sim =>
      RUNNING_SIMULATION_STATES.includes(sim.state)
    );
  });

  // get servers that are not running a simulation, sorted by health status
  const availableServers = _(configuration.servers)
    .filter(
      (config, serverId) =>
        simulations[serverId] && simulations[serverId].stoppedSimulation
    )
    .shuffle()
    .sortBy(
      ({ id }) =>
        HEALTH_STATUS_PRIORITY[health[id] && health[id].state] ||
        HEALTH_STATUS_PRIORITY.DOWN
    )
    .value();

  // get servers that have no backend running on them
  const downServers = _(configuration.servers)
    .filter(
      (config, serverId) =>
      !simulations[serverId]
    )
    .shuffle()
    .value();

  // build dictionary<expId, server> of joinnable servers
  const joinableServers = {};
  _.forOwn(simulations, ({ runningSimulation }, serverId) => {
    if (
      runningSimulation &&
      runningSimulation.state !== SIMULATION_STATES.HALTED
    ) {
      if (!joinableServers[runningSimulation.experimentConfiguration])
        joinableServers[runningSimulation.experimentConfiguration] = [];

      joinableServers[runningSimulation.experimentConfiguration].push({
        server: serverId,
        runningSimulation
      });
    }
  });
  return [joinableServers, simulations, availableServers, health, downServers];
}

export default {
  setToken,
  getExperimentsAndSimulations,
  RUNNING_SIMULATION_STATES
};
