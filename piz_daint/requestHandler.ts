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

const q = require('q'),
  URL = require('url');

// tslint:disable: prefer-const
let request = q.denodeify(require('request')),
  fsReadFile = q.denodeify(require('fs').readFile);
// tslint:enable: prefer-const
let configuration;
const proxyRequestHandler = require('../proxy/requestHandler').default;

function initialize(config) {
  if (!config['daint-cscs']) {
    console.log('Daint-cscs config not in the config.json, you will not be able to start any jobs on the supercomputer');
  } else {
    configuration = config['daint-cscs'];
  }
}

async function getIPAndPort(server?) {
  let serverConfig;
  if (!server) {
    const servers = await proxyRequestHandler.getServersWithNoBackend();
    if (servers.length === 0)
      throw new Error('No server available to take this request');
    serverConfig = servers[0];
  } else {
    serverConfig = await proxyRequestHandler.getServer(server);
  }
  const url = URL.parse(serverConfig.gzweb['nrp-services']);
  return [url.hostname, url.port];
}

function readUpload(authToken, readPath, uploadPath) {
  const headers = getPizDaintHeaders(authToken, 'PUT');
  headers.headers['Content-Type'] = 'application/octet-stream';
  headers.json = false;
  const path = readPath.replace(/\$([A-Z_a-z]*)/g, (m, v) => process.env[v]);
  return fsReadFile(path, 'utf8')
    .then((file) => {
      return request(uploadPath, { ...headers, body: file });
    })
    .then((response) => {
      checkResponseStatus(uploadPath, response[0]);
    });
}

function uploadFilesForJob(authToken, uploadUrl) {
  const basePath = configuration.job_file_location;
  return Promise.all([
    readUpload(authToken, `${basePath}/input.sh`, `${uploadUrl}/input.sh`),
    readUpload(
      authToken,
      `${basePath}/key-tunneluser`,
      `${uploadUrl}/key-tunneluser`
    )
  ]);
}

async function setUpJob(authToken, server) {
  try {
    console.log('Submiting job..');
    const jobUrl = await submitJob(authToken, server);
    console.log('Getting job info..');
    const jobInfo = (await getJobStatus(authToken, jobUrl))._links;
    console.log('Uploading files..');
    await uploadFilesForJob(
      authToken,
      `${jobInfo.workingDirectory.href}/files`
    );
    console.log('Starting job..');
    await invokeAction(authToken, jobInfo['action:start'].href);
    return jobUrl;
  } catch (err) {
    throw new Error(`Failed to set up job. ERROR: ${err}`);
  }
}

async function submitJob(authToken, server) {
  const serverConfig = await getIPAndPort(server);
  let tunnelIP = serverConfig[0];
  const tunnelPort = serverConfig[1];
  const baseUrl = configuration.job_url;
  const headers = getPizDaintHeaders(authToken, 'POST');
  // set UC_PREFER_INTERACTIVE_EXECUTION to 'true' to run on login-nodes
  const body = {
    Resources: { Runtime: '1200', NodeConstraints: 'gpu,startx', Nodes: '1' },
    ApplicationName: 'Bash shell',
    Parameters: {
      SOURCE: 'input.sh',
      UC_PREFER_INTERACTIVE_EXECUTION: 'false'
    },
    haveClientsStageIn: 'true',
    Environment: { TUNNEL_HOST: '148.187.97.12', TARGET_PORT: '8080' }
  };
  if (body.Environment.TUNNEL_HOST !== tunnelIP) {
    console.warn(
      `You are not using the same IP for the backend as the hardcoded TUNNEL_HOST.
      Since this feature is in test mode I'm going to change it.`);
    tunnelIP = body.Environment.TUNNEL_HOST;
  }
  body.Environment.TUNNEL_HOST = tunnelIP;
  body.Environment.TARGET_PORT = tunnelPort;
  const response = (await request(baseUrl, { ...headers, body }))[0];
  checkResponseStatus(baseUrl, response);
  return response.headers.location;
}

async function invokeAction(authToken, url) {
  const headers = getPizDaintHeaders(authToken, 'POST');
  const response = (await request(url, { ...headers, body: {} }))[0];
  checkResponseStatus(url, response);
}

function checkResponseStatus(url, response) {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `Failed to execute request ${url}. ERROR: ${response.statusMessage}`
    );
  }
}

function getPizDaintHeaders(authToken, requestMethod) {
  return {
    method: requestMethod,
    agentOptions: {
      rejectUnauthorized: false
    },
    headers: { Authorization: `Bearer ${authToken}` },
    json: true
  };
}

async function getJobs(authToken) {
  let response;
  try {
    // get list of all users job urls
    const responseArray = await request(
      configuration.job_url,
      getPizDaintHeaders(authToken, 'GET')
    );
    response = responseArray[0];
  } catch (err) {
    throw new Error(
      `Failed to execute request ${configuration.job_url}. ERROR: ${err}`
    );
  }
  checkResponseStatus(configuration.job_url, response);
  // using job_urls get each jobs info
  const promises: Array<Promise<any>> = [];
  response.body.jobs.forEach((jobUrl) => {
    const promise = getJobStatus(authToken, jobUrl);
    promises.push(promise);
  });
  return await Promise.all(promises);
}

async function getJobStatus(authToken, jobUrl) {
  let response;
  try {
    const responseArray = await request(
      jobUrl,
      getPizDaintHeaders(authToken, 'GET')
    );
    response = responseArray[0];
  } catch (err) {
    throw new Error(`Failed to execute request ${jobUrl}. ERROR: ${err}`);
  }
  checkResponseStatus(jobUrl, response);
  return response.body;
}
function getFile(authToken, fileUrl) {
  const req = getPizDaintHeaders(authToken, 'GET');
  const newRequest = { ...req, headers: { ...req.headers, Accept: 'application/octet-stream' } };
  return request(fileUrl, newRequest).then((response) => {
    checkResponseStatus(fileUrl, response[0]);
    return response[0].body;
  });
}

async function getJobOutcome(authToken, jobUrl) {
  const workingDir = (await getJobStatus(authToken, jobUrl))._links
    .workingDirectory.href;
  return Promise.all([
    getFile(authToken, `${workingDir}/files/stdout`),
    getFile(authToken, `${workingDir}/files/stderr`)
  ]);
}

export default {
  initialize,
  getJobs,
  getJobStatus,
  getJobOutcome,
  setUpJob
};
