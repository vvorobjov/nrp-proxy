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
  BaseStorage = require('../BaseStorage.js'),
  CollabConnector = require('./CollabConnector.js');

class Storage extends BaseStorage {
  constructor(config) {
    super();
    this.config = config;
  }

  handleError(err) {
    let errType = Object.prototype.toString.call(err).slice(8, -1);
    if (errType === 'Object' && err.statusCode)
      if (err.statusCode === 403)
        return q.reject({ code: 302, msg: 'https://services.humanbrainproject.eu/oidc/authorize?response_type=token' });
      else
        return q.reject({ code: err.statusCode, msg: err.message });
    return q.reject(err);
  }

  listFiles(experiment, token) {
    return CollabConnector.instance.folderContent(token, experiment).catch(this.handleError);
  }

  getFile(filename, experiment, token) {
    return CollabConnector.instance.entityContent(token, filename).catch(this.handleError);
  }

  deleteFile(filename, experiment, token) {
    return CollabConnector.instance.deleteFile(token, experiment, filename).catch(this.handleError);
  }

  createOrUpdate(filename, fileContent, contentType, experiment, token) {
    return CollabConnector.instance.folderContent(token, experiment)
      .then(files => {
        let file = files.find(f => f.name === filename);
        file = file ? q.when(file) : CollabConnector.instance.createFile(token, experiment, filename, contentType);
        return file.then(file => CollabConnector.instance.uploadContent(token, file.uuid, fileContent));
      }).catch(this.handleError);
  }

  listExperiments(token) {
    return CollabConnector.instance.getEntity(token, this.config.collabId)
      .then(entity => CollabConnector.instance.projectFolders(token, entity.uuid)).catch(this.handleError);

  }

  createExperiment(newExperiment, token) {
    return CollabConnector.instance.getEntity(token, this.config.collabId)
      .then(entity => CollabConnector.instance.createFolder(token, entity.uuid, newExperiment)).catch(this.handleError);
  }
}

module.exports = Storage;