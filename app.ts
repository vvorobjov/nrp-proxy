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
 * ---LICENSE-END
 **/

'use strict';

import bodyParser from 'body-parser';
import express from 'express';
import iplocation from 'iplocation';
import _ from 'lodash';
import path from 'path';
import ActivityLogger from './activity_logs/ActivityLogger';
import AdminService from './admin/AdminService';
import pizDaintRequestHandler from './piz_daint/requestHandler';
import ExperimentServiceFactory from './proxy/ExperimentServiceFactory';
import proxyRequestHandler from './proxy/requestHandler';
import StorageRequestHandler from './storage/requestHandler';
import configurationManager from './utils/configurationManager';
import loggerManager from './utils/loggerManager';

require('./migration_scripts/sprint72.js');

const app = express();

configurationManager.initialize();
const config = configurationManager.loadConfigFile();
configurationManager.watch();

proxyRequestHandler.initialize(config);
pizDaintRequestHandler.initialize(config);

const storageRequestHandler = new StorageRequestHandler(config),
  adminService = new AdminService(config, proxyRequestHandler),
  activityLogger = new ActivityLogger(config['activity-logs']),
  experimentServiceFactory = new ExperimentServiceFactory(
    storageRequestHandler,
    config,
    proxyRequestHandler
  );

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'accept, Authorization, Context-Id, Content-Type'
  );
  res.setHeader('Access-Control-Expose-Headers', 'uuid, content-disposition');
  next();
});

const checkAdminRights = (req, res, next) => {
  return storageRequestHandler
    .getUserGroups(getAuthToken(req))
    .then(groups => {
      if (!groups.some(g => g.name === 'hbp-sp10-administrators'))
        throw 'Administration rights required';
    })
    .then(() => next())
    .catch(err => {
      res.status(401).send(err);
      throw err;
    });
};

const isAdmin = req => {
  return storageRequestHandler
    .getUserGroups(getAuthToken(req))
    .then(groups => groups.some(g => g.name === 'hbp-sp10-administrators'));
};

app.post(/^\/admin\//, checkAdminRights);

app.get('/admin/status', (_req, res, next) => {
  adminService
    .getStatus()
    .then(r => res.send(r))
    .catch(next);
});

app.post('/admin/status/:maintenance', (req, res, next) =>
  adminService
    .setStatus(req.params.maintenance === 'true')
    .then(r => res.send(r))
    .catch(next)
);

app.get('/admin/servers', (_req, res, next) =>
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

app.get('/experimentImage/:experiment', (req, res, next) => {
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

app.get('/experiments', (_req, res, next) => {
  proxyRequestHandler
    .getExperiments()
    .then(r => res.send(r))
    .catch(next);
});

app.get('/server/:serverId', (req, res, next) => {
  proxyRequestHandler
    .getServer(req.params.serverId)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/availableServers', (_req, res, next) => {
  proxyRequestHandler
    .getAvailableServers()
    .then(r => res.send(r))
    .catch(next);
});

app.get('/models/:modelType', (req, res, next) => {
  proxyRequestHandler
    .getModels(req.params.modelType)
    .then(r => res.send(r))
    .catch(next);
});

app.get('/models/:modelType/:modelId/config', (req, res, next) => {
  proxyRequestHandler
    .getModelConfig(req.params.modelType, req.params.modelId)
    .then(config => res.sendFile(config))
    .catch(next);
});

// storage API
app.use(bodyParser.json({ limit: '200mb' }));
app.use(bodyParser.raw({ limit: '200mb' }));
app.use(bodyParser.text({ type: () => true, limit: '200mb' }));

const handleError = (res, err) => {
  const errType = Object.prototype.toString.call(err).slice(8, -1);

  if (errType === 'String' || errType === 'Error' || !err.code) {
    if (errType === 'Error') {
      console.error('[ERROR] ' + err + '\n' + err.stack);
      err = err.message;
    } else console.error('[ERROR] ' + err);
    res.status(500).send(err);
  } else {
    const errMsg =
      err.code === 403
        ? 'Authentication error'
        : err.msg ? err.msg : `code: ${err.code}`;

    if (err.code !== 204) {
      // 204= file not found
      console.error(`[ERROR] ${errMsg}`);
    }
    res.status(err.code).send(errMsg);
  }
};

app.post('/authentication/authenticate', (req, res) => {
  storageRequestHandler
    .authenticate(req.body.user, req.body.password)
    .then(auth => loggerManager.log(req.body.user) && auth)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/authentication/loginpage', (_req, res) => {
  storageRequestHandler
    .getLoginPage()
    .then(r => res.sendFile(r))
    .catch(_.partial(handleError, res));
});

const getAuthToken = req => {
  if (config.auth.demoToken) return config.auth.demoToken;

  const authorization = req.get('authorization');
  if (!authorization || authorization.length < 7)
    throw 'Authorization header missing';
  return authorization.length > 7 && authorization.substr(7);
};

app.get('/storage/experiments', verifyRunningMode);

app.get('/storage/experiments', async (req, res) => {
  try {
    const experiments = await storageRequestHandler.listExperiments(
      getAuthToken(req),
      req.get('context-id'),
      req.query /*options*/
    );
    const joinableServerPromises = experiments.map(exp =>
      proxyRequestHandler.getJoinableServers(exp.uuid).then(joinableServers => {
        exp.joinableServers = joinableServers;
      })
    );

    const configurationPromises = experiments.map(
      exp =>
        experimentServiceFactory
          .createExperimentService(exp.uuid, getAuthToken(req))
          .getConfig()
          .then(configuration => {
            exp.configuration = {
              maturity: 'production',
              ...configuration
            };
          })
          .catch(() => null) // null if no config found (eg: missing exc)
    );

    await Promise.all([...joinableServerPromises, ...configurationPromises]);

    const decoratedExperiments = experiments
      .filter(exp => exp.configuration) // discard experiments without config
      .map(exp => ({
        ...exp,
        id: exp.uuid,
        private: true
      }));

    res.send(decoratedExperiments);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/storage/clone', (req, res) => {
  return storageRequestHandler
    .cloneExperiment(getAuthToken(req), req.body.expPath, req.get('context-id'))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post('/storage/sharedmode/:experimentId/:sharedMode', (req, res) => {
  storageRequestHandler
    .updateSharedExperimentMode(
      req.params.experimentId,
      req.params.sharedMode,
      getAuthToken(req)
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/sharedusers/:experimentId', (req, res) => {
  storageRequestHandler
    .listSharedUsersbyExperiment(req.params.experimentId, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/sharedExperiments', (req, res) => {
  proxyRequestHandler
    .getSharedExperiments(getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.delete('/storage/sharedusers/:experimentId/:userId', (req, res) => {
  storageRequestHandler
    .deleteSharedUserFromExperiment(
      req.params.experimentId,
      req.params.userId,
      getAuthToken(req)
    )
    .then(r => res.send(r || ''))
    .catch(_.partial(handleError, res));
});

app.post('/storage/sharedusers/:experimentId/:userId', (req, res) => {
  storageRequestHandler
    .addUsertoSharedUserListinExperiment(
      req.params.experimentId,
      req.params.userId,
      getAuthToken(req)
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/sharedvalue/:experimentId', (req, res) => {
  storageRequestHandler
    .getExperimentSharedMode(req.params.experimentId, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post('/storage/clonenew', (req, res) => {
  return storageRequestHandler
    .cloneNewExperiment(
      getAuthToken(req),
      req.get('context-id'),
      req.body.modelsPaths,
      req.body.experimentName
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
app.get('/storage/custommodels/all/:modelType', (req, res) => {
  if (!~['brains', 'robots', 'environments'].indexOf(req.params.modelType))
    return handleError(res, `Invalid model type: ${req.params.modelType}`);

  storageRequestHandler
    .listAllCustomModels(
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

app.put('/storage/custommodel/:modelPath', (req, res) => {
  storageRequestHandler
    .unzipCustomModel(req.params.modelPath, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/custommodel/:modelPath', (req, res) => {
  storageRequestHandler
    .getCustomModel(req.params.modelPath, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/custommodelconfig/:modelType/:modelPath', (req, res) => {
  storageRequestHandler
    .getCustomModelConfig(
      { uuid: path.join(req.params.modelType, req.params.modelPath) },
      getAuthToken(req)
    )
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
  const fnName = req.query.type === 'folder' ? 'deleteFolder' : 'deleteFile';
  const deleted = storageRequestHandler[fnName](
    req.params.filename,
    req.params.experiment,
    getAuthToken(req),
    req.query.byname === 'true'
  );

  deleted.then(r => res.send(r || '')).catch(_.partial(handleError, res));
});

app.delete('/storage/:experiment', (req, res) => {
  storageRequestHandler
    .deleteExperiment(
      req.params.experiment,
      req.params.experiment,
      getAuthToken(req)
    )
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
      getAuthToken(req),
      req.query.append
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

app.get('/experiment/:experimentId/config', async (req, res) => {
  experimentServiceFactory
    .createExperimentService(req.params.experimentId, getAuthToken(req))
    .getConfig()
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/experiment/:experiment/brain', async (req, res) => {
  experimentServiceFactory
    .createExperimentService(
      req.params.experiment,
      getAuthToken(req),
      req.query.template === 'true'
    )
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

app.get('/experiment/:experiment/stateMachines', async (req, res) => {
  experimentServiceFactory
    .createExperimentService(
      req.params.experiment,
      getAuthToken(req),
      req.query.template === 'true'
    )
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

app.get('/experiment/:experiment/transferFunctions', (req, res) => {
  experimentServiceFactory
    .createExperimentService(
      req.params.experiment,
      getAuthToken(req),
      req.query.template === 'true'
    )
    .getTransferFunctions()
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/experiment/:experiment/csvfiles', async (req, res) => {
  try {
    const csvFiles = await experimentServiceFactory
      .createExperimentService(req.params.experiment, getAuthToken(req))
      .getCSVFiles();
    res.send(csvFiles);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/submitjob', async (req, res) => {
  try {
    res.send(await pizDaintRequestHandler.setUpJob(getAuthToken(req)));
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/getjobs', async (req, res) => {
  try {
    res.send(await pizDaintRequestHandler.getJobs(getAuthToken(req)));
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/getjobinfo', async (req, res) => {
  try {
    res.send(
      await pizDaintRequestHandler.getJobStatus(
        getAuthToken(req),
        req.query.jobUrl
      )
    );
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/getjoboutcome', async (req, res) => {
  try {
    res.send(
      await pizDaintRequestHandler.getJobOutcome(
        getAuthToken(req),
        req.query.jobUrl
      )
    );
  } catch (err) {
    handleError(res, err);
  }
});

app.put('/experiment/:experiment/transferFunctions', (req, res) => {
  experimentServiceFactory
    .createExperimentService(req.params.experiment, getAuthToken(req))
    .saveTransferFunctions(req.body.transferFunctions)
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/identity/gdpr', (req, res) => {
  storageRequestHandler
    .getGDPRStatus(getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post('/identity/gdpr', (req, res) => {
  storageRequestHandler
    .acceptGDPRStatus(getAuthToken(req))
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
app.get('/identity/me/users', (req, res) => {
  storageRequestHandler
    .getUsersList(getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

const getReqIp = req =>
  req.headers['x-forwarded-for'] || req.connection.remoteAddress;

const ANONYMOUS_ACTIVITIES = new Set(['install', 'update']);

app.post('/activity_log/:activity', async (req, res) => {
  try {
    const logData = { user: 'ANONYMOUS' };
    if (!ANONYMOUS_ACTIVITIES.has(req.params.activity)) {
      const userInfo = await storageRequestHandler.getUserInfo(
        'me',
        getAuthToken(req)
      );
      logData.user = userInfo.displayName;
    }

    const clientIP = getReqIp(req);
    const ipdata = await iplocation(clientIP);
    const r = await activityLogger.log(req.params.activity, {
      ...logData,
      ...req.body,
      city: String(ipdata.city),
      country: String(ipdata.country)
    });
    res.send(r);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/checkupdate', async (req, res) => {
  const packagePath = require('path').resolve('./package.json');
  const version = require(packagePath).version;
  const clientIP = getReqIp(req);
  const ipdata = await iplocation(clientIP);

  activityLogger.log('check_update', {
    ...req.body,
    city: ipdata.city,
    country: ipdata.country
  });

  res.send({ version });
});

configurationManager.configuration.then(null, null, conf =>
  proxyRequestHandler.reloadConfiguration(conf)
);

// start server
app.listen(config.port, () => console.log('Listening on port:', config.port));
