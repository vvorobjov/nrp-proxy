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
    console.error(`[Collab error] ${err}`);
    let errType = Object.prototype.toString.call(err).slice(8, -1);
    if (errType === 'Object' && err.statusCode)
      if (err.statusCode === 403 || err.statusCode === 401 && err.message.indexOf('OpenId response: token is not valid') >= 0)
        return q.reject({ code: 302, msg: 'https://services.humanbrainproject.eu/oidc/authorize?response_type=token' });
    return q.reject(err);
  }

  listFiles(experiment, token, filter) {
    return CollabConnector.instance.folderContent(token, experiment).catch(this.handleError);
  }

  getFileUuid(filename, experiment, token) {
    return this.listFiles(experiment, token)
      .then(files => files.filter(f => f.name === filename))
      .then(files => files.length === 0 ? null : files[0].uuid);
  }

  getFile(filename, experiment, token, byname = false) {
    return (byname ? this.getFileUuid(filename, experiment, token) : q.when(filename))
      .then(uuid => q.all([uuid, uuid && CollabConnector.instance.entityContent(token, uuid)]))
      .then(([uuid, content]) => content ? { uuid, contentType: content.contentType, body: content.body } : {})
      .catch(this.handleError);
  }

  deleteFile(filename, experiment, token, byname = false) {
    return (byname ? this.getFileUuid(filename, experiment, token) : q.when(filename))
      .then(uuid => uuid && CollabConnector.instance.deleteFile(token, experiment, uuid))
      .catch(this.handleError);
  }

  createOrUpdate(filename, fileContent, contentType, experiment, token) {
    return CollabConnector.instance.folderContent(token, experiment)
      .then(files => {
        let file = files.find(f => f.name === filename);
        return file || CollabConnector.instance.createFile(token, experiment, filename, contentType);
      })
      .then(file => CollabConnector.instance.uploadContent(token, file.uuid, fileContent))
      .catch(this.handleError);
  }

  getCollabId(token, contextId) {
    return contextId ? CollabConnector.instance.getContextIdCollab(token, contextId) : q.when(this.config.collabId);
  }

  listExperiments(token, contextId) {
    return this.getCollabId(token, contextId)
      .then(collabId => CollabConnector.instance.getEntity(token, collabId))
      .then(entity => CollabConnector.instance.projectFolders(token, entity.uuid))
      .catch(this.handleError);
  }

  createExperiment(newExperiment, token, contextId) {
    return this.getCollabId(token, contextId)
      .then(collabId => CollabConnector.instance.getEntity(token, collabId))
      .then(entity => CollabConnector.instance.createFolder(token, entity.uuid, newExperiment)).catch(this.handleError);
  }
}

module.exports = Storage;