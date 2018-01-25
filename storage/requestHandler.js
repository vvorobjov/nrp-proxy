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

const q = require('q'),
  path = require('path'),
  CustomModelService = require('./CustomModelsService'),
  ExperimentClonner = require('./ExperimentClonner.js');

class RequestHandler {
  constructor(config) {
    try {
      if (!config.storage) throw "'storage' key missing in the config file";
      if (!config.authentication)
        throw "'authentication' key missing in the config file";

      const storageBasePath = path.resolve(
        path.join(__dirname, config.storage)
      );
      const authenticationBasePath = path.resolve(
        path.join(__dirname, config.authentication)
      );

      const Storage = require(path.join(storageBasePath, 'Storage.js'));
      const Authenticator = require(path.join(
        authenticationBasePath,
        'Authenticator.js'
      ));
      const Identity = require(path.join(
        authenticationBasePath,
        'Identity.js'
      ));

      this.config = config;
      this.authenticator = new Authenticator(config);
      this.storage = new Storage(config);
      this.identity = new Identity(config);
      this.customModelService = new CustomModelService();
      this.tokenIdentifierCache = new Map();
    } catch (e) {
      console.error('Failed to instantiate storage implementation', e);
    }
  }

  authenticate(usr, pwd) {
    return this.authenticator.login(usr, pwd);
  }

  getUserIdentifier(token) {
    if (this.tokenIdentifierCache.has(token)) {
      return q.when(this.tokenIdentifierCache.get(token));
    }
    return this.identity.getUniqueIdentifier(token).then(id => {
      this.tokenIdentifierCache.set(token, id);
      return id;
    });
  }

  listFiles(parentDir, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId => this.storage.listFiles(parentDir, token, userId));
  }

  getFile(filename, parentDir, token, byname = false) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.getFile(filename, parentDir, token, userId, byname)
      );
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

  deleteFolder(filename, parentDir, token, byname = false) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.deleteFolder(filename, parentDir, token, userId, byname)
      );
  }

  createOrUpdate(filename, fileContent, contentType, parentDir, token) {
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
          userId
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

  listExperiments(token, contextId, options = {}) {
    const SPECIAL_FOLDERS = new Set(['robots', 'brains', 'environments']);
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.listExperiments(token, userId, contextId, options)
      )
      .then(
        exps =>
          options.filter
            ? exps.filter(e => e.name === options.filter)
            : exps.filter(e => !SPECIAL_FOLDERS.has(e.name))
      );
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

  getCustomModel(modelPath, token) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId => this.storage.getCustomModel(modelPath, token, userId));
  }

  listCustomModels(customFolder, token, contextId) {
    return this.authenticator
      .checkToken(token)
      .then(() => this.getUserIdentifier(token))
      .then(userId =>
        this.storage.listCustomModels(customFolder, token, userId, contextId)
      )
      .then(modelsPaths =>
        q.all(
          modelsPaths.map(path =>
            q.all([path, this.getCustomModel(path, token)])
          )
        )
      )
      .then(models =>
        q.all(
          models.map(([path, data]) =>
            this.customModelService.getZipModelMetaData(path, data)
          )
        )
      );
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

  async cloneExperiment(token, expPath, contextId) {
    await this.authenticator.checkToken(token);
    let userId = await this.getUserIdentifier(token);

    return new ExperimentClonner(this.storage, this.config).cloneExperiment(
      token,
      userId,
      expPath,
      contextId
    );
  }
}

module.exports = RequestHandler;
