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
  ExperimentServiceFactory = require('./proxy/ExperimentServiceFactory'),
  configurationManager = require('./utils/configurationManager.js'),
  loggerManager = require('./utils/loggerManager.js'),
  AdminService = require('./admin/AdminService'),
  ActivityLogger = require('./activity_logs/ActivityLogger'),
  app = express();

configurationManager.initialize();
let config = configurationManager.loadConfigFile();
configurationManager.watch();

proxyRequestHandler.initialize(config);

const storageRequestHandler = new StorageRequestHandler(config),
  adminService = new AdminService(config, proxyRequestHandler),
  activityLogger = new ActivityLogger(config['activity-logs']),
  experimentServiceFactory = new ExperimentServiceFactory(
    storageRequestHandler
  );

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

let checkAdminRights = (req, res, next) => {
  return storageRequestHandler
    .getUserGroups(getAuthToken(req))
    .then(groups => {
      if (!groups.some(g => g.name == 'hbp-sp10-administrators'))
        throw 'Administration rights required';
    })
    .then(() => next())
    .catch(err => {
      res.status(401).send(err);
      throw err;
    });
};

let isAdmin = req => {
  return storageRequestHandler
    .getUserGroups(getAuthToken(req))
    .then(groups => groups.some(g => g.name == 'hbp-sp10-administrators'));
};

app.post(/^\/admin\//, checkAdminRights);

app.get('/admin/status', (req, res, next) => {
  adminService
    .getStatus()
    .then(r => res.send(r))
    .catch(next);
});

app.post('/admin/status/:maintenance', (req, res, next) =>
  adminService
    .setStatus(req.params.maintenance == 'true')
    .then(r => res.send(r))
    .catch(next)
);

app.get('/admin/servers', (req, res, next) =>
  adminService
    .getServersStatus()
    .then(f => res.send(f))
    .catch(next)
);

app.post('/admin/restart/:server', (req, res, next) =>
  adminService
    .restartServer(req.params.server)
    .then(r => res.send(r))
    .catch(next)
);

app.get('/experimentImage/:experiment', function(req, res, next) {
  proxyRequestHandler
    .getExperimentImageFile(req.params.experiment)
    .then(f => res.sendFile(f))
    .catch(next);
});

const verifyRunningMode = (req, res, next) => {
  isAdmin(req).then(answer => {
    adminService.getStatus().then(({ maintenance }) => {
      // Non-admin users are deprived of all services in maintenance mode
      if (maintenance && !answer) res.status(478).end();
      else next();
    });
  });
};

app.get('/maintenancemode', verifyRunningMode);
app.get('/maintenancemode', (_, res) => res.send({}));

app.get('/experiments', verifyRunningMode);

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

app.get('/availableServers', function(req, res, next) {
  proxyRequestHandler
    .getAvailableServers()
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

app.get('/models/:modelType/:modelId/config', function(req, res, next) {
  proxyRequestHandler
    .getModelConfig(req.params.modelType, req.params.modelId)
    .then(config => res.sendFile(config))
    .catch(next);
});

// storage API
app.use(bodyParser.json({ limit: '200mb' }));
app.use(bodyParser.raw({ limit: '200mb' }));
app.use(bodyParser.text({ type: () => true, limit: '200mb' }));

let handleError = (res, err) => {
  let errType = Object.prototype.toString.call(err).slice(8, -1);

  if (errType === 'String' || errType === 'Error' || !err.code) {
    if (errType === 'Error') {
      console.error('[ERROR] ' + err + '\n' + err.stack);
      err = err.message;
    } else console.error('[ERROR] ' + err);
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
    .then(auth => loggerManager.log(req.body.user) && auth)
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
  if (config.auth.demoToken) return config.auth.demoToken;

  let authorization = req.get('authorization');
  if (!authorization || authorization.length < 7)
    throw 'Authorization header missing';
  return authorization.length > 7 && authorization.substr(7);
};

app.get('/storage/experiments', verifyRunningMode);

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

app.post('/storage/clone', (req, res) => {
  return storageRequestHandler
    .cloneExperiment(getAuthToken(req), req.body.expPath, req.get('context-id'))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post('/storage/clonenew', (req, res) => {
  return storageRequestHandler
    .cloneNewExperiment(
      getAuthToken(req),
      req.get('context-id'),
      req.body.modelsPaths
    )
    .then(r => res.send({ newExperiment: r }))
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

app.post('/storage/custommodels/:modelType/:modelName', (req, res) => {
  if (!~['brains', 'robots', 'environments'].indexOf(req.params.modelType))
    return handleError(res, `Invalid model type: ${req.params.modelType}`);

  storageRequestHandler
    .createZip(
      getAuthToken(req),
      req.params.modelType,
      req.params.modelName,
      req.body,
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

app.get('/storage/custommodelconfig/:modelPath', (req, res) => {
  storageRequestHandler
    .getCustomModelConfig({ uuid: req.params.modelPath }, getAuthToken(req))
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

app.post('/storage/clone/:experiment', (req, res) => {
  if (!req.params.experiment)
    return handleError(res, 'Experiment name is required');

  storageRequestHandler
    .copyExperiment(
      req.params.experiment,
      getAuthToken(req),
      req.get('context-id')
    )
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

app.get('/experiment/:experiment/brain', async (req, res) => {
  experimentServiceFactory
    .createExperimentService(req.params.experiment, getAuthToken(req))
    .getBrain()
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.put('/experiment/:experiment/brain', async (req, res) => {
  experimentServiceFactory
    .createExperimentService(req.params.experiment, getAuthToken(req))
    .setBrain(req.body.brain, req.body.populations)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/experiment/:experiment/transferFunctions', async (req, res) => {
  experimentServiceFactory
    .createExperimentService(req.params.experiment, getAuthToken(req))
    .getTransferFunctions()
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/experiment/:experiment/stateMachines', async (req, res) => {
  experimentServiceFactory
    .createExperimentService(req.params.experiment, getAuthToken(req))
    .getStateMachines()
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.put('/experiment/:experiment/stateMachines', async (req, res) => {
  experimentServiceFactory
    .createExperimentService(req.params.experiment, getAuthToken(req))
    .setStateMachines(req.body.stateMachines)
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

app.post('/activity_log/:activity', async (req, res) => {
  let userInfo = await storageRequestHandler.getUserInfo(
    'me',
    getAuthToken(req)
  );

  try {
    let r = await activityLogger.log(
      req.params.activity,
      userInfo.displayName,
      req.body
    );
    res.send(r);
  } catch (err) {
    res.status(202).send(err);
  }
});

configurationManager.configuration.then(null, null, conf =>
  proxyRequestHandler.reloadConfiguration(conf)
);

//start server
app.listen(config.port, () => console.log('Listening on port:', config.port));
