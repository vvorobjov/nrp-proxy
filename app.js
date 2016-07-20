var fs = require('fs');
var express = require('express');
var _ = require('lodash');
var serversProxy = require('./serversProxy.js');
var oidcAuthenticator = require('./oidcAuthenticator.js');

var CONFIG_FILE = './config.json';
var LOG_FILE = './log.config';
var configuration = JSON.parse(fs.readFileSync(CONFIG_FILE));
var port = configuration.port;
var app = express();

var experiment_list = {};
var servers = {};

var update_rate = 60 * 1000; // one minute

// watcher for config file to re-parse if the file has been edited
fs.watch(CONFIG_FILE, function (event, filename) {
  try {
    configuration = JSON.parse(fs.readFileSync(CONFIG_FILE));
    console.log("Received " + event + " for configuration file " + CONFIG_FILE + ". Reparsing");
  }
  catch (err) {
    console.error(err);
  }
});

function updateExperimentList() {
  return oidcAuthenticator(configuration.auth.url)
    .getToken(configuration.auth.clientId, configuration.auth.clientSecret)
    .then(_.partial(serversProxy.getExperiments, configuration, _))
    .then(function (experiments) {
      experiment_list = experiments;
    })
    .fail(function (err) {
      console.error("Failed to get experiments: ", err);
    });
}

function startServer(port) {
  app.listen(port, function () {
    console.log("Listening on port: " + port);
  });
}

startServer(port);
updateExperimentList();
setInterval(updateExperimentList, update_rate);

app.get('/experiments', function (req, res) {
  res.send("Experiment List: " + JSON.stringify(experiment_list, null, '\t'));
});
