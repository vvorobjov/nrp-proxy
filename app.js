'use strict';

var fs = require('fs');
var express = require('express');

var requestHandler = require('./requestHandler.js');

var app = express();

var updateInterval = 5 * 1000; // interval in ms

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
  app.listen(requestHandler.configuration.port, function () {
    console.log('Listening on port:', requestHandler.configuration.port);
  });
}

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'accept, authorization');
  next();
});

app.get('/experimentImage/:experiments', function (req, res) {
  requestHandler.getExperimentImage(req.connection.remoteAddress, req.params.experiments)
  .then(function (response) {
    res.send(response);
  })
  .catch(function (response) {
    res.status(500).send(response);
  });
});

app.get('/experiments', function (req, res) {
  requestHandler.getExperiments(req.connection.remoteAddress)
    .then(function (response) {
      res.send(response);
    })
    .catch(function (response) {
      res.status(500).send(response);
    });
});

app.get('/server/:serverId', function(req, res) {
  requestHandler.getServer(req.connection.remoteAddress, req.params.serverId)
    .then(function (response) {
      res.send(response);
    })
    .catch(function (response) {
      res.status(500).send(response);
    });
});

app.get('/availableServers/:experimentId', function(req, res) {
  requestHandler.getAvailableServers(req.connection.remoteAddress, req.params.experimentId)
    .then(function (response) {
      res.send(response);
    })
    .catch(function (response) {
      res.status(500).send(response);
    });
});

app.get('/joinableServers/:contextId', function(req, res) {
  requestHandler.getJoinableServers(req.connection.remoteAddress, req.params.contextId)
    .then(function (response) {
      res.send(response);
    })
    .catch(function (response) {
      res.status(500).send(response);
    });
});

startServer();
console.log('Polling Backend Servers for Experiments, Health & Running Simulations every', updateInterval, 'ms.');
requestHandler.updateExperimentList(updateInterval);
