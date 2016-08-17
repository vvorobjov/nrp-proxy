'use strict';

var fs = require('fs');
var path = require('path');
var express = require('express');
var _ = require('lodash');
var q = require('q');

var oidcAuthenticator = require('./oidcAuthenticator.js');
var serversProxy = require('./serversProxy.js');

// path.resolve is required because the current directory is recreated regularly by puppet
// and when that happens fs.readFileSync fails if using a relative path
var CONFIG_FILE = path.resolve('./config.json');

var configuration;
var oidcToken;

var app = express();
var experimentList = {};

var updateInterval = 5 * 1000; // interval in ms
function readConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE));
  }
  catch (err) {
    if (err.code === 'ENOENT' && typeof configuration === 'undefined') {
      console.log('config.json not found! Please create a config.json from config.json.sample and run again!');
    }
    console.error(err);
  }
}

configuration = readConfigFile();
var port = configuration.port;

// watcher for config file to re-parse if the file has been edited
fs.watchFile(CONFIG_FILE, function (curr, prev) {
  if (!curr.isFile()) {
    console.log('config.json has been deleted! Continuing with the previously-parsed version.');
    return;
  }
  console.log('Received change for configuration file. Reparsing.');
  configuration = readConfigFile();
});

function updateExperimentList() {
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
      console.error('Failed to get experiments: ', err);
    })
    .finally(function () {
      setTimeout(updateExperimentList, updateInterval);
    });
}

function startServer(port) {
  app.listen(port, function () {
    console.log('Listening on port: ' + port);
  });
}

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

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'accept, authorization');
  next();
});

app.get('/experimentImage/:experiments', function (req, res) {
  if (!req.params.experiments) {
    res.send({});
  }
  var experiments = req.params.experiments.split(',');
  q.all(experiments.map(function (exp) {
    return serversProxy.getExperimentImage(exp, experimentList, configuration);
  }))
    .then(_.fromPairs)
    .then(function (images) {
      res.send(images);
    }).catch(function (err) {
      console.error('Failed to get experiments images: ', err);
    });

});

app.get('/experiments', function (req, res) {
  if (req.query.experimentId) {
    if (!req.query.contextId) {
      res.status(500).send('\'contextId\' query string missing');
    } else {
      res.send(filterJoinableExperimentByContext(_.pick(experimentList, req.query.experimentId), req.query.contextId));
    }
  } else {
    res.send(filterJoinableExperimentByContext(experimentList, null));
  }
});

app.get('/server/:serverId', function (req, res) {
  if (req.params.serverId) {
    res.send(configuration.servers[req.params.serverId]);
  } else {
    res.status(500).send('\'serverId\' query string missing');
  }
});

startServer(port);

updateExperimentList();
