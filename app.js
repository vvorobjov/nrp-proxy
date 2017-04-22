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

var fs = require('fs');
var express = require('express');

var requestHandler = require('./requestHandler.js');

var app = express();

// watcher for config file to re-parse if the file has been edited
fs.watchFile(requestHandler.CONFIG_FILE, function (curr, prev) {
  if (!curr.isFile()) {
    console.log('config.json has been deleted! Continuing with the previously-parsed version.');
    return;
  }
  console.log('Received change for configuration file. Reparsing.');
  requestHandler.reloadConfigFile();
});

function startServer() {
  var port = requestHandler.getConfiguration().port;
  app.listen(port, function () {
    console.log('Listening on port:', port);
  });
}

app.use(function (req, res, next) {
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
  requestHandler.getExperimentImage(req.params.experiments)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/experiments', function(req, res, next) {
  requestHandler.getExperiments()
    .then(r => res.send(r))
    .catch(next);
});

app.get('/server/:serverId', function(req, res, next) {
  requestHandler.getServer(req.params.serverId)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/availableServers/:experimentId?', function(req, res, next) {
  requestHandler.getAvailableServers(req.params.experimentId)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/joinableServers/:contextId', function(req, res, next) {
  requestHandler.getJoinableServers(req.params.contextId)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/models/:modelType', function(req, res, next) {
  requestHandler.getModels(req.params.modelType)
    .then(r => res.send(r))
    .catch(next);
});

requestHandler.initialize();

startServer();
