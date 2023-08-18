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
import AdminService from './admin/AdminService';
import ExperimentServiceFactory from './proxy/ExperimentServiceFactory';
import proxyRequestHandler from './proxy/requestHandler';
import StorageRequestHandler from './storage/requestHandler';
import * as storageConsts from './storage/StorageConsts';
import configurationManager from './utils/configurationManager';
import loggerManager from './utils/loggerManager';

require('./migration_scripts/sprint72.js');

const app = express();

configurationManager.initialize();
const config = configurationManager.loadConfigFile();
configurationManager.watch();

proxyRequestHandler.initialize(config);

const storageRequestHandler = new StorageRequestHandler(config);
const adminService = new AdminService(config, proxyRequestHandler);
const experimentServiceFactory = new ExperimentServiceFactory(
  storageRequestHandler,
  config,
  proxyRequestHandler
);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, PUT, POST, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Authorization, Context-Id, Content-Type, Origin, X-Requested-With'
  );

  res.setHeader('Access-Control-Expose-Headers', 'uuid, content-disposition');
  next();
});

const checkAdminRights = (req, res, next) => {
  return storageRequestHandler
    .getUserGroups(getAuthToken(req))
    .then(groups => {
      if (!groups.some(g => g === 'group-HBP-NRP-Admins'))
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
    .then(groups => groups.some(g => g === 'group-HBP-NRP-Admins'));
};

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
        : err.msg
        ? err.msg
        : `code: ${err.code}`;

    if (err.code !== 204) {
      // 204= file not found
      console.error(`[ERROR] ${errMsg}`);
    }
    res.status(err.code).send(errMsg);
  }
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

app.post('/admin/backendlogs/:server', (req, res, next) =>
  adminService
    .retrieveServerLogs(req.params.server)
    .then(r => res.sendFile(r))
    .catch(_.partial(handleError, res))
);

// TODO: [NRRPLT-8681] Fix endpoint
app.get('/experimentImage/:experiment', (req, res, next) => {
  proxyRequestHandler
    .getExperimentImageFile(req.params.experiment)
    .then(f => res.sendFile(f))
    .catch(next);
});

// TODO: [NRRPLT-8953] create userGroups cache
// const verifyRunningMode = (req, res, next) => {
//   isAdmin(req).then(answer => {
//     adminService.getStatus().then(({ maintenance }) => {
//       // Non-admin users are deprived of all services in maintenance mode
//       if (maintenance && !answer) res.status(478).end();
//       else next();
//     });
//   });
// };

// TODO: [NRRPLT-8953] create userGroups cache
// app.get('/maintenancemode', verifyRunningMode);
app.get('/maintenancemode', (_, res) => res.send({}));

// TODO: [NRRPLT-8953] create userGroups cache
// app.get('/experiments', verifyRunningMode);

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

app.get('/serversWithNoBackend', (_req, res, next) => {
  proxyRequestHandler
    .getServersWithNoBackend()
    .then(r => res.send(r))
    .catch(next);
});

// storage API
app.use(bodyParser.json({ limit: '2000mb' }));
app.use(bodyParser.raw({ limit: '2000mb' }));
app.use(bodyParser.text({ type: () => true, limit: '2000mb' }));

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

// TODO: [NRRPLT-8953] create userGroups cache
// app.get('/storage/experiments', verifyRunningMode);

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
    const configurationPromises = experiments.map(exp =>
      experimentServiceFactory
        .createExperimentService(exp.uuid, getAuthToken(req))
        .getConfig()
        .then(configuration => {
          exp.configuration = {
            maturity: 'production',
            experimentId: path.join(exp.uuid, storageConsts.defaultConfigName),
            path: exp.uuid,
            configFile: storageConsts.defaultConfigName,
            ...configuration
          };
        })
        .catch(_.partial(handleError, res))
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

app.post('/storage/models/:type/:modelId/sharing/:userId', (req, res) => {
  storageRequestHandler
    .addUsertoSharingUserListinModel(
      req.params.type,
      req.params.modelId,
      req.params.userId,
      getAuthToken(req)
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/models/:type/:modelId/sharingusers', (req, res) => {
  storageRequestHandler
    .listSharingUsersbyModel(
      req.params.type,
      req.params.modelId,
      getAuthToken(req)
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post(
  '/storage/models/:modelType/:modelId/sharingmode/:sharingMode',
  (req, res) => {
    storageRequestHandler
      .updateSharedModelMode(
        req.params.modelType,
        req.params.modelId,
        req.params.sharingMode,
        getAuthToken(req)
      )
      .then(r => res.send(r))
      .catch(_.partial(handleError, res));
  }
);

app.get('/storage/models/:modelType/:modelId/sharingmode', (req, res) => {
  storageRequestHandler
    .getModelSharingMode(
      req.params.modelType,
      req.params.modelId,
      getAuthToken(req)
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.delete(
  '/storage/models/:modelType/:modelId/sharingusers/:userId',
  (req, res) => {
    storageRequestHandler
      .deleteSharingUserFromModel(
        req.params.modelType,
        req.params.modelId,
        req.params.userId,
        getAuthToken(req)
      )
      .then(r => res.send(r || ''))
      .catch(_.partial(handleError, res));
  }
);

app.get('/storage/models/shared/:modelType', (req, res) => {
  storageRequestHandler
    .listSharedModels(req.params.modelType, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/models/all/:modelType', (req, res) => {
  // it returns all the models of the users: the ones he owns and the ones are sharing with him.
  storageRequestHandler
    .listAllModels(req.params.modelType, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/knowledgeGraphBrains/:query', (req, res) => {
  // it returns all the brains from Knowledge Graph
  storageRequestHandler
    .getKnowledgeGraphBrains(req.params.query, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/models/:modelType', (req, res) => {
  storageRequestHandler
    .listModelsbyType(req.params.modelType, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/experiments/:experimentId/sharingusers', (req, res) => {
  storageRequestHandler
    .listSharingUsersbyExperiment(req.params.experimentId, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post(
  '/storage/experiments/:experimentId/sharingmode/:sharingMode',
  (req, res) => {
    storageRequestHandler
      .updateSharedExperimentMode(
        req.params.experimentId,
        req.params.sharingMode,
        getAuthToken(req)
      )
      .then(r => res.send(r))
      .catch(_.partial(handleError, res));
  }
);

app.get('/storage/experiments/shared', (req, res) => {
  proxyRequestHandler
    .getSharedExperiments(getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.delete(
  '/storage/experiments/:experimentId/sharingusers/:userId',
  (req, res) => {
    storageRequestHandler
      .deleteSharingUserFromExperiment(
        req.params.experimentId,
        req.params.userId,
        getAuthToken(req)
      )
      .then(r => res.send(r || ''))
      .catch(_.partial(handleError, res));
  }
);

app.post(
  '/storage/experiments/:experimentId/sharingusers/:userId',
  (req, res) => {
    storageRequestHandler
      .addUsertoSharingUserListinExperiment(
        req.params.experimentId,
        req.params.userId,
        getAuthToken(req)
      )
      .then(r => res.send(r))
      .catch(_.partial(handleError, res));
  }
);

app.get('/storage/experiments/:experimentId/sharingmode', (req, res) => {
  storageRequestHandler
    .getExperimentSharingMode(req.params.experimentId, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.put('/storage/experiments/:experimentId/rename', (req, res) => {
  storageRequestHandler
    .renameExperiment(
      req.params.experimentId,
      // reg.body.experimentConfig,
      req.body.newSimulationName,
      getAuthToken(req)
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post('/storage/clonenew', (req, res) => {
  return storageRequestHandler
    .cloneNewExperiment(
      getAuthToken(req),
      req.get('context-id'),
      req.body.environmentPath,
      req.body.experimentName,
      req.body.experimentMode
    )
    .then(r => res.send({ newExperiment: r }))
    .catch(_.partial(handleError, res));
});

app.get('/storage/models/user/:modelType', (req, res) => {
  storageRequestHandler
    .listUserModelsbyType(req.params.modelType, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.delete('/storage/models/:modelType/:modelName', (req, res) => {
  storageRequestHandler
    .deleteCustomModel(
      req.params.modelType,
      req.params.modelName,
      getAuthToken(req)
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post('/storage/models/:modelType/:modelName', (req, res) => {
  storageRequestHandler
    .createZip(
      getAuthToken(req),
      req.params.modelType,
      req.params.modelName,
      req.body,
      req.query.override
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/models/:modelType/:modelName', (req, res) => {
  storageRequestHandler
    .getModelZip(req.params.modelType, req.params.modelName, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/models/path/:modelType/:modelName', (req, res) => {
  storageRequestHandler
    .getModelPath(req.params.modelType, req.params.modelName, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/models/:modelType/:modelName/config', (req, res, next) => {
  storageRequestHandler
    .getModelConfigFullPath(
      req.params.modelType,
      req.params.modelName,
      getAuthToken(req)
    )
    .then(config => res.sendFile(config))
    .catch(next);
});

app.post('/storage/importExperiment', async (req, res) => {
  const token = getAuthToken(req);
  storageRequestHandler
    .registerZippedExperiment(
      token,
      req.get('context-id'),
      req.body // zip file
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post('/storage/scanStorage', async (req, res) => {
  const token = getAuthToken(req);
  storageRequestHandler
    .scanStorage(token, req.get('context-id'))
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
      if (r.uuid) {
        res.header('uuid', r.uuid);
      }
      res.header('content-type', r.contentType);
      res.header('content-disposition', r.contentDisposition);
      res.send(r.body);
    })
    .catch(_.partial(handleError, res));
});

// TODO: [NRRPLT-8725] add zipping of the experiment for 4.0
app.get('/storage/experiments/:experiment/zip', async (req, res) => {
  storageRequestHandler
    .getExperimentZips(req.params.experiment, getAuthToken(req))
    .then(r => res.download(r.experimentZip.path, r.experimentZip.name))
    .catch(_.partial(handleError, res));
});

// ultimately unsafe
// app.get('/storage/zip', (req, res) => {
//   res.download(req.query.path, req.query.name);
// });

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
    .then(r => {
      res.send(r || '');
    })
    .catch(_.partial(handleError, res));
});

app.post('/storage/:experiment/*', (req, res) => {
  if (!req.params['0']) return handleError(res, 'File name is required');
  let promise: Promise<unknown>;
  if (req.query.type === 'folder') {
    promise = storageRequestHandler.createFolder(
      req.params['0'],
      req.params.experiment,
      getAuthToken(req)
    );
  } else if (req.query.type === 'zip') {
    promise = storageRequestHandler.unzip(
      req.params['0'],
      req.body,
      req.params.experiment,
      getAuthToken(req)
    );
  } else {
    promise = storageRequestHandler.createOrUpdate(
      req.params['0'],
      req.body,
      req.get('content-type'),
      req.params.experiment,
      getAuthToken(req),
      req.query.append
    );
  }

  promise.then(r => res.send(r || '')).catch(_.partial(handleError, res));
});

app.get('/storage/:experiment', (req, res) => {
  storageRequestHandler
    .listFiles(req.params.experiment, getAuthToken(req))
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.post('/storage/:experiment', (req, res) => {
  storageRequestHandler
    .createExperiment(
      req.params.experiment,
      getAuthToken(req),
      req.get('context-id')
    )
    .then(r => res.send(r))
    .catch(_.partial(handleError, res));
});

app.get('/storage/knowledgeGraph/data/:filename', (req, res) => {
  storageRequestHandler
    .getKgAttachment(req.params.filename)
    .then(r => res.sendFile(r))
    .catch(_.partial(handleError, res));
});

app.put('/storage/knowledgeGraph/data/:filename', (req, res) => {
  storageRequestHandler
    .createOrUpdateKgAttachment(req.params.filename, req.body)
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
  // experimentServiceFactory
  //   .createExperimentService(
  //     req.params.experiment,
  //     getAuthToken(req),
  //     req.query.template === 'true'
  //   )
  //   .getBrain()
  //   .then(r => res.send(r))
  //   .catch(_.partial(handleError, res));
  res.send('Endpoint unsupported');
});

app.put('/experiment/:experiment/brain', async (req, res) => {
  // experimentServiceFactory
  //   .createExperimentService(req.params.experiment, getAuthToken(req))
  //   .setBrain(req.body.brain, req.body.populations, req.body.removePopulations, req.body.newBrain)
  //   .then(r => res.send(r))
  //   .catch(_.partial(handleError, res));
  res.send('Endpoint unsupported');
});

app.get('/experiment/:experiment/stateMachines', async (req, res) => {
  // experimentServiceFactory
  //   .createExperimentService(
  //     req.params.experiment,
  //     getAuthToken(req),
  //     req.query.template === 'true'
  //   )
  //   .getStateMachines()
  //   .then(r => res.send(r))
  //   .catch(_.partial(handleError, res));
  res.send('Endpoint unsupported');
});

app.put('/experiment/:experiment/stateMachines', async (req, res) => {
  // experimentServiceFactory
  //   .createExperimentService(req.params.experiment, getAuthToken(req))
  //   .setStateMachines(req.body.stateMachines)
  //   .then(r => res.send(r))
  //   .catch(_.partial(handleError, res));
  res.send('Endpoint unsupported');
});

app.get('/experiment/:experiment/transferFunctions', (req, res) => {
  // experimentServiceFactory
  //   .createExperimentService(
  //     req.params.experiment,
  //     getAuthToken(req),
  //     req.query.template === 'true'
  //   )
  //   .getTransferFunctions()
  //   .then(r => res.send(r))
  //   .catch(_.partial(handleError, res));
  res.send('Endpoint unsupported');
});

app.get('/experiment/:experiment/files/:filetype', async (req, res) => {
  try {
    const files = await experimentServiceFactory
      .createExperimentService(req.params.experiment, getAuthToken(req))
      .getFiles(req.params.filetype);
    res.send(files);
  } catch (err) {
    handleError(res, err);
  }
});

app.put('/experiment/:experiment/transferFunctions', (req, res) => {
  // experimentServiceFactory
  //   .createExperimentService(req.params.experiment, getAuthToken(req))
  //   .saveTransferFunctions(req.body.transferFunctions)
  //   .then(r => res.send(r))
  //   .catch(_.partial(handleError, res));
  res.send('Endpoint unsupported');
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

app.post('/checkupdate', async (req, res) => {
  const packagePath = require('path').resolve('./package.json');
  const version = require(packagePath).version;
  const clientIP = getReqIp(req);
  const ipdata = await iplocation(clientIP);

  res.send({ version });
});

/**
 * Checks the number of available backends.
 * If there are available backends, responds with JSON {service: "healthy"}
 * If there are no backends, responds with JSON {service: "unavailable"}
 * The response status 200 confirms the unavailability of the proxy itself
 */
app.get('/health', (req, res, next) => {
  proxyRequestHandler
    .getAvailableServers()
    .then(servers => {
      if (servers.length > 0) {
        res.send({ service: 'healthy' });
      } else {
        res.send({ service: 'unavailable' });
      }
    })
    .catch(next);
});

configurationManager.configuration.then(null, null, conf =>
  proxyRequestHandler.reloadConfiguration(conf)
);

// start server
app.listen(config.port, () => console.log('Listening on port:', config.port));
