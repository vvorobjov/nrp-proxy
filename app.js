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

const express = require('express'),
  _ = require('lodash'),
  bodyParser = require('body-parser');

require('./migration_scripts/sprint72.js');

const proxyRequestHandler = require('./proxy/requestHandler.js'),
  StorageRequestHandler = require('./storage/requestHandler.js'),
  configurationManager = require('./utils/configurationManager.js'),
  app = express();

configurationManager.initialize();
let configFile = configurationManager.loadConfigFile();
configurationManager.watch();

proxyRequestHandler.initialize(configFile);
let storageRequestHandler = new StorageRequestHandler(configFile);

app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'accept, Authorization, Context-Id, Content-Type'
  );
  res.setHeader('Access-Control-Expose-Headers', 'uuid, content-disposition');
  next();
});

app.use(function(req, res, next) {
  if (req.method !== 'OPTIONS')
    console.log(
      `[REQUEST from ${req.connection.remoteAddress}] ${req.method} ${req.url}`
    );
  next();
});

app.get('/experimentImage/:experiment', function(req, res, next) {
  proxyRequestHandler
    .getExperimentImageFile(req.params.experiment)
    .then(f => res.sendFile(f))
    .catch(next);
});

app.get('/experiments', function(req, res, next) {
  proxyRequestHandler
    .getExperiments()
    .then(r => res.send(r))
    .catch(next);
});

app.get('/server/:serverId', function(req, res, next) {
  proxyRequestHandler
    .getServer(req.params.serverId)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/availableServers/:experimentId?', function(req, res, next) {
  proxyRequestHandler
    .getAvailableServers(req.params.experimentId)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/joinableServers/:experimentId', function(req, res, next) {
  proxyRequestHandler
    .getJoinableServers(req.params.experimentId)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/models/:modelType', function(req, res, next) {
  proxyRequestHandler
    .getModels(req.params.modelType)
    .then(r => res.send(r))
    .catch(next);
});

// storage API
app.use(bodyParser.json({ limit: '200mb' }));
app.use(bodyParser.raw({ limit: '200mb' }));
app.use(bodyParser.text({ type: () => true, limit: '200mb' }));

let handleError = (res, err) => {
  let errType = Object.prototype.toString.call(err).slice(8, -1);

  if (errType === 'String' || errType === 'Error' || !err.code) {
    if (errType === 'Error') err = err.message;
    console.error('[ERROR] ' + err);
    res.status(500).send(err);
  } else {
    if (err.code !== 204)
      // 204= file not found
      console.error('[ERROR] ' + err.msg);
    res.status(err.code).send(err.msg);
  }
};

app.post('/authentication/authenticate', (req, res) => {
  storageRequestHandler
    .authenticate(req.body.user, req.body.password)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/authentication/loginpage', (req, res) => {
  storageRequestHandler
    .getLoginPage()
    .then(r => res.sendFile(r))
    .catch(_.partial(handleError, res));
});

let getAuthToken = req => {
  let authorization = req.get('authorization');
  if (!authorization || authorization.length < 7)
    throw 'Authorization header missing';
  return authorization.length > 7 && authorization.substr(7);
};

app.get('/storage/experiments', (req, res) => {
  storageRequestHandler
    .listExperiments(
      getAuthToken(req),
      req.get('context-id'),
      req.query /*options*/
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/custommodels/:modelType', (req, res) => {
  if (!~['brains', 'robots', 'environments'].indexOf(req.params.modelType))
    return handleError(res, `Invalid model type: ${req.params.modelType}`);

  storageRequestHandler
    .listCustomModels(
      req.params.modelType,
      getAuthToken(req),
      req.get('context-id')
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/custommodel/:modelPath', (req, res) => {
  storageRequestHandler
    .getCustomModel(req.params.modelPath, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/:experiment/:filename', (req, res) => {
  storageRequestHandler
    .getFile(
      req.params.filename,
      req.params.experiment,
      getAuthToken(req),
      req.query.byname === 'true'
    )
    .then(r => {
      r.uuid && res.header('uuid', r.uuid);
      res.header('content-type', r.contentType);
      res.header('content-disposition', r.contentDisposition);
      res.send(r.body);
    })
    .catch(_.partial(handleError, res));
});

app.delete('/storage/:experiment/:filename', (req, res) => {
  let args = [
    req.params.filename,
    req.params.experiment,
    getAuthToken(req),
    req.query.byname === 'true'
  ];
  let deleted =
    req.query.type === 'folder'
      ? storageRequestHandler.deleteFolder(...args)
      : storageRequestHandler.deleteFile(...args);

  deleted.then(r => res.send(r || '')).catch(_.partial(handleError, res));
});

app.delete('/storage/:experiment', (req, res) => {
  let args = [req.params.experiment, req.params.experiment, getAuthToken(req)];
  storageRequestHandler
    .deleteExperiment(...args)
    .then(r => res.send(r || ''))
    .catch(_.partial(handleError, res));
});

app.post('/storage/:experiment/*', (req, res) => {
  if (!req.params['0']) return handleError(res, 'File name is required');

  (req.query.type === 'folder'
    ? storageRequestHandler.createFolder(
        req.params['0'],
        req.params.experiment,
        getAuthToken(req)
      )
    : storageRequestHandler.createOrUpdate(
        req.params['0'],
        req.body,
        req.get('content-type'),
        req.params.experiment,
        getAuthToken(req)
      )
  )
    .then(r => res.send(r || ''))
    .catch(_.partial(handleError, res));
});

app.get('/storage/:experiment', (req, res) => {
  storageRequestHandler
    .listFiles(req.params.experiment, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.put('/storage/:experiment', (req, res) => {
  storageRequestHandler
    .createExperiment(
      req.params.experiment,
      getAuthToken(req),
      req.get('context-id')
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/identity/:userid', (req, res) => {
  storageRequestHandler
    .getUserInfo(req.params.userid, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/identity/me/groups', (req, res) => {
  storageRequestHandler
    .getUserGroups(getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

configurationManager.configuration.then(null, null, conf =>
  proxyRequestHandler.reloadConfiguration(conf)
);

//start server
app.listen(configFile.port, () =>
  console.log('Listening on port:', configFile.port)
);
