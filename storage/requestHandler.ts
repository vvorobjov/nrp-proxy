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

import { File } from './BaseStorage';
import * as ExperimentCloner from './ExperimentCloner';
import { ExperimentImporter } from './ExperimentImporter';
import utils from './FS/utils';
import ModelsService from './ModelsService';
const request = require('request-promise');
const _ = require('lodash');

// test mocked
// tslint:disable: prefer-const
let { TemplateExperimentCloner, NewExperimentCloner } = ExperimentCloner,
  GDPR = require('./GDPR').default,
  experimentImporter = require('./ExperimentImporter'),
  experimentZipper = require('./ExperimentZipper'),
  zip = require('zip-a-folder'),
  tmp = require('tmp'),
  fs = require('fs-extra');
// tslint:enable: prefer-const

const q = require('q'),
  path = require('path');

// mocked on unit tests
// tslint:disable-next-line: prefer-const
let modelsService = new ModelsService();

const gdprService = new GDPR();

export default class RequestHandler {
  private authenticator;
  private storage;
  private identity;
  private modelsService;
  private tokenIdentifierCache;
  private newExperimentPath;

  constructor(private config) {
    try {
      if (!config.storage) throw `'storage' key missing in the config file`;
      if (!config.authentication)
        throw `'authentication' key missing in the config file`;

      this.loadDependenciesInjection();

      this.modelsService = new ModelsService();
      this.tokenIdentifierCache = new Map();
      this.newExperimentPath = path.join('template_new', 'TemplateNew.exc');
    } catch (e) {
      console.error('Failed to instantiate storage implementation', e);
    }
  }

  async loadDependenciesInjection() {
    try {
      const storageBasePath = path.resolve(
        path.join(__dirname, this.config.storage)
      );
      const authenticationBasePath = path.resolve(
        path.join(__dirname, this.config.authentication)
      );

      const { Storage } = await import(path.join(storageBasePath, 'Storage'));
      const { Authenticator } = await import(path.join(
        authenticationBasePath,
        'Authenticator'
      ));
      const { Identity } = await require(path.join(
        authenticationBasePath,
        'Identity'
      ));

      this.authenticator = new Authenticator(this.config);
      this.storage = new Storage(this.config);
      this.identity = new Identity(this.config);
    } catch (ex) {
      console.error(`Impossible to lazy load injected dependencies:
${ex.stack}`);
      process.exit(1);
    }
  }

  authenticate(usr, pwd) {
    return this.authenticator.login(usr, pwd);
  }

  async getGDPRStatus(token) {
    const userId = await this.getUserIdentifier(token);
    const gdpr = await gdprService.getUserAcceptedGDPR(userId);
    return { gdpr };
  }

  async acceptGDPRStatus(token) {
    const userId = await this.getUserIdentifier(token);
    return gdprService.setUserAcceptedGDPR(userId);
  }

  async getUserIdentifier(token) {
    if (this.tokenIdentifierCache.has(token))
      return q.when(this.tokenIdentifierCache.get(token));

    const id = await this.identity.getUniqueIdentifier(token);
    this.tokenIdentifierCache.set(token, id);
    return id;
  }

  listFiles(parentDir: string, token: string): Promise<File[]> {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId => this.storage.listFiles(parentDir, token, userId));
  }

  async getFile(filename, parentDir, token, byname = false) {
    await this.authenticator.checkToken(token);
    const userId = await this.getUserIdentifier(token);
    return this.storage.getFile(filename, parentDir, token, userId, byname);
  }

  deleteFile(filename, parentDir, token, byname = false) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.deleteFile(filename, parentDir, token, userId, byname)
      );
  }

  deleteExperiment(experimentName, parentDir, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.deleteExperiment(experimentName, parentDir, token, userId)
      );
  }

  renameExperiment(experimentID, newSimulationName, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.renameExperiment(experimentID, newSimulationName, token, userId)
      );
  }

  deleteFolder(filename, parentDir, token, byname = false) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.deleteFolder(filename, parentDir, token, userId, byname)
      );
  }

  createOrUpdate(
    filename,
    fileContent,
    contentType,
    parentDir,
    token,
    append = false
  ) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.createOrUpdate(
          filename,
          fileContent,
          contentType,
          parentDir,
          token,
          userId,
          append
        )
      );
  }

  createFolder(foldername, parentDir, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.createFolder(foldername, parentDir, token, userId)
      );
  }

  async listExperiments(token, contextId, options = { filter: undefined }) {
    const SPECIAL_FOLDERS = new Set(['robots', 'brains', 'environments']);
    await this.authenticator.checkToken(token);
    const userId = await this.getUserIdentifier(token);
    const privateExps = await this.storage.listExperiments(
      token,
      userId,
      contextId,
      options
    );
    const sharedExp = await this.listExperimentsSharedByUsers(token);
    const exps = [
      ...privateExps.map(exp => ({ ...exp, owned: true })),
      ...sharedExp.map(exp => ({ ...exp, owned: false }))
    ];
    return options.filter
      ? exps.filter(e => e.name === options.filter)
      : exps.filter(e => !SPECIAL_FOLDERS.has(e.name));
  }

  addUsertoSharingUserListinExperiment(newExperiment, userId, token) {
    return this.authenticator
      .checkToken(token)
      .then(() =>
        this.storage.addUsertoSharingUserListinExperiment(newExperiment, userId)
      );
  }
  listExperimentsSharedByUsers(token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId => this.storage.listExperimentsSharedByUsers(userId));
  }

  createExperiment(newExperiment, token, contextId) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.createExperiment(newExperiment, token, userId, contextId)
      );
  }

  copyExperiment(experiment, token, contextId) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.copyExperiment(experiment, token, userId, contextId)
      );
  }

  getModelPath(type, name, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(() => this.storage.getModelPath(type, name));
  }

  getModelZip(type, name, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(() => this.storage.getModelZip(type, name));
  }

  async deleteCustomModel(modelType, modelName, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId => this.storage.deleteCustomModel(modelType, modelName, userId));
  }

  async createCustomModel(model, zipFile, override) {
    await this.authenticator.checkToken(model.ownerId);
    model.ownerName = await this.getUserIdentifier(model.ownerId);
    return this.storage.createCustomModel(
      model, zipFile, override
    );
  }

  createZip(userName, modelType, zipName, zip, override) {
    const model = {
      ownerId: userName,
      type: modelType,
    };
    return modelsService
      .getZipModelMetaData(model, zip)
      .then(modelData =>
        this.createCustomModel(modelData, zip, override)
      );
  }

  listModelsbyType(customFolder, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.listModelsbyType(customFolder)
      );
  }

  async listUserModelsbyType(modelType, token) {
    await this.authenticator.checkToken(token);
    const userId = await this.getUserIdentifier(token);
    const userModels = await this.storage.listUserModelsbyType(modelType, userId);
    const models = await q.all(
      userModels.map(userModel =>
        q.all([userModel, this.getModelZip(userModel.modelType,
          userModel.fileName,
          token)])
      )
    );
    const metaData = await q.all(
      models.map(([model, data]) =>
        this.modelsService.getZipModelMetaData(
          model,
          data
        )
      ));
    return metaData;
  }

  getLoginPage() {
    return this.authenticator.getLoginPage();
  }

  getUserInfo(userId, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.identity.getUserInfo(userId, token));
  }

  getUserGroups(token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId => this.identity.getUserGroups(token, userId));
  }

  getUsersList(token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.identity.getUsersList(token));
  }

  async cloneExperiment(token, expPath, contextId) {
    await this.authenticator.checkToken(token);
    const userId = await this.getUserIdentifier(token);
    return new TemplateExperimentCloner(
      this.storage,
      this.config
    ).cloneExperiment(token, userId, expPath, contextId, undefined, undefined);
  }
  /*shared models*/
  addUsertoSharingUserListinModel(modelType, modelId, userId, token) {
    return this.authenticator
      .checkToken(token)
      .then(() =>
        this.storage.addUsertoSharingUserListinModel(modelType, modelId, userId)
      );
  }

  listSharingUsersbyModel(modelType, modelID, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.storage.listSharingUsersbyModel(modelType, modelID));
  }

  updateSharedModelMode(modelType, modelId, sharingOption, token) {
    return this.authenticator
      .checkToken(token)
      .then(() =>
        this.storage.updateSharedModelMode(modelType, modelId, sharingOption)
      );
  }

  getModelSharingMode(modelType, modelID, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.storage.getModelSharingMode(modelType, modelID));
  }

  deleteSharingUserFromModel(modeltType, modelId, userId, token) {
    return this.authenticator
      .checkToken(token)
      .then(() =>
        this.storage.deleteSharingUserFromModel(modeltType, modelId, userId)
      )
      .then(res => res);
  }

  deleteSharingUserFromExperiment(experimentId, userId, token) {
    return this.authenticator
      .checkToken(token)
      .then(() =>
        this.storage.deleteSharingUserFromExperiment(experimentId, userId)
      )
      .then(res => res);
  }

  listSharedModels(modelType, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.listSharedModels(modelType, userId)
      )
      .then(sharedModels => {
        return q.all(
          sharedModels.map(sharedModel =>
            q.all([sharedModel, this.getModelZip(sharedModel.modelType, sharedModel.fileName, token)])
          )
        );
      }
      )
      .then(models =>
        q.all(
          models.map(([model, data]) =>
            this.modelsService.getZipModelMetaData(
              model,
              data
            )
          )
        )
      );
  }

  listAllModels(type, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(ownerId =>
        this.storage.listAllModels(type, ownerId))
      .then(allModels =>
        q.all(
          allModels.map(model =>
            q.all([model, this.getModelZip(model.type, model.name, token)])
          )
        )
      )
      .then(models =>
        q.all(
          models.map(([model, data]) =>
            this.modelsService.getZipModelMetaData(
              model,
              data
            )
          )
        )
      );
  }

  transformKnowledgeGraphBrains(knowledgeGraphBrains, brainScripts) {
    return knowledgeGraphBrains.map((knowledgeGraphBrain, index) =>
      ({
        name: knowledgeGraphBrain.name,
        description: knowledgeGraphBrain.description,
        maturity: 'production',
        thumbnail: undefined,
        script: brainScripts[index],
        urls: { fileLoader: knowledgeGraphBrain.file_loader, fileUrl: knowledgeGraphBrain.file_url },
        id: knowledgeGraphBrain.file_loader ? knowledgeGraphBrain.file_loader.split('/').pop() : undefined,
        '@id': knowledgeGraphBrain['@id']
      })
    );
  }

  async get(extraOptions, url) {
    const requestOptions = {
      resolveWithFullResponse: true,
      timeout: '5000',
    };
    _.extend(requestOptions, { url, ...extraOptions });
    return request(requestOptions);
  }

  async getKnowledgeGraphBrains(query, token) {
    if (this.config.authentication === 'FS') {
      return [];
    }
    // tslint:disable-next-line:max-line-length
    const kgUrl = `https://kg-int.humanbrainproject.eu/query/sp6/core/pointneuronnetwork/v1.0.0/sp10/instances?size=20&databaseScope=INFERRED&vocab=https%3A%2F%2Fschema.hbp.eu%2F${query}%2F`;
    const knowledgeGraphBrainsResponse = await this.get(
      {
        headers: {
          Authorization: token,
          accept: 'application/json'
        }
      }, kgUrl);
    const knowledgeGraphBrains = JSON.parse(knowledgeGraphBrainsResponse.body).results;
    const knowledgeGraphBrainScripts = await q.all(knowledgeGraphBrains.map(knowledgeGraphBrain =>
        this.get({}, knowledgeGraphBrain.file_loader || '')));
    const brainScripts = knowledgeGraphBrainScripts.map(brainScriptResponse => brainScriptResponse.body);
    return this.transformKnowledgeGraphBrains(knowledgeGraphBrains, brainScripts);
  }

  updateSharedExperimentMode(experimentId, sharingOption, token) {
    return this.authenticator
      .checkToken(token)
      .then(() =>
        this.storage.updateSharedExperimentMode(experimentId, sharingOption)
      );
  }
  getExperimentSharingMode(experimentID, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.storage.getExperimentSharingMode(experimentID));
  }

  listSharingUsersbyExperiment(experimentID, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.storage.listSharingUsersbyExperiment(experimentID));
  }

  async cloneNewExperiment(token, contextId, environmentPath, defaultName, defaultMode) {
    await this.authenticator.checkToken(token);
    const userId = await this.getUserIdentifier(token);

    return new NewExperimentCloner(
      this.storage,
      this.config,
      environmentPath,
      this.newExperimentPath
    ).cloneExperiment(
      token,
      userId,
      this.newExperimentPath,
      contextId,
      defaultName,
      defaultMode
    );
  }

  async registerZippedExperiment(token, contextId, zip) {
    const userId = await this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token));
    return new ExperimentImporter(this.storage, token, userId, contextId).registerZippedExperiment(zip);
  }

  async scanStorage(token, contextId) {
    const userId = await this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token));
    return new ExperimentImporter(this.storage, token, userId, contextId).scanStorage();
  }

  getStoragePath() {
    return this.storage.getStoragePath();
  }

  async getExperimentZips(experimentId, token, bibi, exc) {
    /* Returns an object containing the metadata of all the zips related to an experiment.
    These are all the experiment folder files zipped, the custom environment and custom robots
    if any. The actual zipping of the experiment is done by the ExperimentZipper */
    const zips = { experimentZip: {}, envZip: {}, robotZips: [] as any };

    // experiment zip
    const userId = await this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token));

    try {
      const experimentZip = await new experimentZipper.ExperimentZipper(this.storage, token, userId).zipExperiment(experimentId);
      zips.experimentZip = { path: experimentZip, name: '' };
    } catch (err) {
      console.error(`Zipping experiment failed. Error : ${err}`);
      return q.reject(err);
    }

    // robot zip. The bibi.bodyModel can be either an Object or an Array
    if (bibi.bodyModel) {
      const customRobots = await this.storage.listUserModelsbyType('robots', userId);
      if (bibi.bodyModel instanceof Array) {
        for (const bodyModel of bibi.bodyModel) {
            const modelZip = await this.createTmpModelZip(zips, bodyModel, customRobots);
            if (modelZip) {
              zips.robotZips.push(modelZip);
            }
        }
      } else if (bibi.bodyModel instanceof Object) {
        const modelZip = await this.createTmpModelZip(zips, bibi.bodyModel, customRobots);
        if (modelZip) {
          zips.robotZips.push(modelZip);
        }
      }
    }

    // env zip
    if (exc.environmentModel._model) {
      const customEnvs = await this.storage.listUserModelsbyType('environments', userId);
      const modelZip = await this.createTmpModelZip(zips, exc.environmentModel._model, customEnvs);
      if (modelZip) {
        zips.envZip = modelZip;
      }
    } else {
      zips.envZip = { path: '', name: '' };
    }

    return zips;
  }

  async createTmpModelZip(zips, model, customModels) {
    const dbModel = customModels.find(cm => cm.name === model._model);
    if (!dbModel || !dbModel.isCustom) {
      return null;
    }

    const tmpFolder = tmp.dirSync();
    const modelDirectoryCopy = path.join(tmpFolder.name, dbModel.path);
    await q.denodeify(fs.mkdir)(modelDirectoryCopy);
    fs.copySync(path.join(this.getStoragePath(), 'USER_DATA', dbModel.type, dbModel.path), modelDirectoryCopy);
    const zipPath = tmp.fileSync();
    await zip.zip(tmpFolder.name, zipPath.name);
    return { path: zipPath.name, name: dbModel.name + '.zip' };
  }

  createOrUpdateKgAttachment(filename, content) {
    return this.storage.createOrUpdateKgAttachment(filename, content);
  }

  getKgAttachment(filename) {
    return this.storage.getKgAttachment(filename);
  }

  unzip(filename, fileContent, parentDir, token) {
    return this.authenticator.checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId => this.storage.unzip(
      filename,
      fileContent,
      parentDir,
      userId
    ));
  }

  async getModelConfigFullPath(modelType, modelName, token) {
    await this.authenticator.checkToken(token);
    const userId = await this.getUserIdentifier(token);
    const models = await this.storage.listAllModels(modelType, userId);
    const model = models.filter(m => m.name === modelName)[0];
    if (!model) {
      return q.reject(`Unable to retrieve the config of ${modelName}.`);
    } else {
      return this.storage.getModelConfigFullPath(model);
    }

  }
}
