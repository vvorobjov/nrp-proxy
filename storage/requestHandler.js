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

const fs = require('fs'),
  path = require('path'),
  _ = require('lodash'),
  q = require('q');

class RequestHandler {
  constructor(config) {
    try {
      if (!config.storage)
        throw '\'storage\' key missing in the config file';

      const basePath = path.resolve(path.join(__dirname, config.storage.type));

      const Authenticator = require(path.join(basePath, 'Authenticator.js')),
        Storage = require(path.join(basePath, 'Storage.js'));

      this.authenticator = new Authenticator(config.storage);
      this.storage = new Storage(config.storage);
    }
    catch (e) {
      console.error('Failed to instantiate storage implementation', e);
    }
  }
  authenticate(usr, pwd) {
    return this.authenticator.login(usr, pwd);
  }
  listFiles(parentDir, token) {
    return this.authenticator.checkToken(token)
      .then(() => this.storage.listFiles(parentDir, token));
  }
  getFile(filename, parentDir, token, byname = false) {
    return this.authenticator.checkToken(token)
      .then(() => this.storage.getFile(filename, parentDir, token, byname));
  }

  deleteFile(filename, parentDir, token, byname = false) {
    return this.authenticator.checkToken(token)
      .then(() => this.storage.deleteFile(filename, parentDir, token, byname));
  }

  deleteFolder(filename, parentDir, token, byname = false) {
    return this.authenticator.checkToken(token)
      .then(() => this.storage.deleteFolder(filename, parentDir, token, byname));
  }

  createOrUpdate(filename, fileContent, contentType, parentDir, token) {
    return this.authenticator.checkToken(token)
      .then(() => this.storage.createOrUpdate(filename, fileContent, contentType, parentDir, token));
  }

  createFolder(foldername, parentDir, token) {
    return this.authenticator.checkToken(token)
      .then(() => this.storage.createFolder(foldername, parentDir, token));
  }

  listExperiments(token, contextId, filter) {
    const SPECIAL_FOLDERS = new Set(['robots', 'brains', 'environments']);
    return this.authenticator.checkToken(token)
      .then(() => this.storage.listExperiments(token, contextId))
      .then(exps => filter
        ? exps.filter(e => e.name === filter)
        : exps.filter(e => !SPECIAL_FOLDERS.has(e.name)
        )
      );
  }
  createExperiment(newExperiment, token, contextId) {
    return this.authenticator.checkToken(token)
      .then(() => this.storage.createExperiment(newExperiment, token, contextId));
  }
  getLoginPage() {
    return this.authenticator.getLoginPage();
  }
}

module.exports = RequestHandler;