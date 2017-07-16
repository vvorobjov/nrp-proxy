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
  res.setHeader('Access-Control-Allow-Headers', 'accept, authorization');
  next();
});

app.use(function(req, res, next) {
  if (req.method !== 'OPTIONS')
    console.log(`[FRONTEND REQUEST from ${req.connection.remoteAddress}] ${req.method} ${req.url}`);
  next();
});

app.get('/experimentImage/:experiments', function(req, res, next) {
  proxyRequestHandler.getExperimentImage(req.params.experiments)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/experiments', function(req, res, next) {
  proxyRequestHandler.getExperiments()
    .then(r => res.send(r))
    .catch(next);
});

app.get('/server/:serverId', function(req, res, next) {
  proxyRequestHandler.getServer(req.params.serverId)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/availableServers/:experimentId?', function(req, res, next) {
  proxyRequestHandler.getAvailableServers(req.params.experimentId)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/joinableServers/:contextId', function(req, res, next) {
  proxyRequestHandler.getJoinableServers(req.params.contextId)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/models/:modelType', function(req, res, next) {
  proxyRequestHandler.getModels(req.params.modelType)
    .then(r => res.send(r))
    .catch(next);
});

// storage API
app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use(bodyParser.text({ type: () => true }));

let handleError = (res, err) => {
  let errType = Object.prototype.toString.call(err).slice(8, -1);
  if (errType === 'String' || errType === 'Error') {
    console.error('[ERROR] ' + err);
    res.status(418).send(err);
  } else
    res.status(err.code).send(err.msg);
};

app.post('/storage/authenticate', (req, res, next) => {
  storageRequestHandler.authenticate(req.body.user, req.body.password)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/loginpage', (req, res, next) => {
  storageRequestHandler.getLoginPage()
    .then(r => res.sendFile(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/experiments', (req, res, next) => {
  storageRequestHandler.listExperiments(req.query.token)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/:experiment/:filename', (req, res, next) => {
  storageRequestHandler.getFile(req.params.filename, req.params.experiment, req.query.token)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.delete('/storage/:experiment/:filename', (req, res, next) => {
  storageRequestHandler.deleteFile(req.params.filename, req.params.experiment, req.query.token)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post('/storage/:experiment/:filename', (req, res, next) => {
  storageRequestHandler.createOrUpdate(req.params.filename, req.body, req.headers['content-type'],
    req.params.experiment, req.query.token)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/:experiment', (req, res, next) => {
  storageRequestHandler.listFiles(req.params.experiment, req.query.token)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.put('/storage/:experiment', (req, res, next) => {
  storageRequestHandler.createExperiment(req.params.experiment, req.query.token)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

//start server
app.listen(configFile.port, () => console.log('Listening on port:', configFile.port));

configurationManager.configuration
  .then(null, null, conf => proxyRequestHandler.reloadConfiguration(conf));
