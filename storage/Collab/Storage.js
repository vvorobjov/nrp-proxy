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

  listFiles(experiment, token) {
    return CollabConnector.instance.folderContent(token, experiment);
  }

  getFileUuid(filename, experiment, token) {
    return this.listFiles(experiment, token)
      .then(files => files.filter(f => f.name === filename))
      .then(files => (files.length === 0 ? null : files[0].uuid));
  }

  getFile(filename, experiment, token, userId, byname = false) {
    return (byname
      ? this.getFileUuid(filename, experiment, token)
      : q.when(filename)
    )
      .then(uuid =>
        q.all([
          uuid,
          uuid && CollabConnector.instance.entityContent(token, uuid)
        ])
      )
      .then(
        ([uuid, content]) =>
          content
            ? {
                uuid,
                contentType: content.headers['content-type'],
                contentDisposition: content.headers['content-disposition'],
                body: content.body
              }
            : {}
      );
  }

  deleteEntity(
    filename,
    experiment,
    token,
    userId,
    byname = false,
    isFolder = false
  ) {
    return (byname
      ? this.getFileUuid(filename, experiment, token)
      : q.when(filename)
    ).then(
      uuid =>
        uuid &&
        CollabConnector.instance.deleteEntity(
          token,
          experiment,
          uuid,
          isFolder ? 'folder' : 'file'
        )
    );
  }

  deleteFile(filename, experiment, token, userId, byname = false) {
    return this.deleteEntity(filename, experiment, token, byname, false);
  }

  deleteFolder(foldername, experiment, token, userId, byname = false) {
    return this.deleteEntity(foldername, experiment, token, byname, true);
  }

  ensurePath(pathparts, parent, contentType, token) {
    let fileType = pathparts.length > 1 ? 'folder' : 'file';
    return CollabConnector.instance
      .folderContent(token, parent)
      .then(contents => {
        let foundEntity = contents.find(
          f => f.name === pathparts[0] && f.type === fileType
        );
        if (foundEntity) return foundEntity;
        return fileType === 'file'
          ? CollabConnector.instance.createFile(
              token,
              parent,
              pathparts[0],
              contentType
            )
          : CollabConnector.instance.createFolder(token, parent, pathparts[0]);
      })
      .then(foundEntity => {
        if (fileType === 'file') return foundEntity;
        return this.ensurePath(
          pathparts.slice(1),
          foundEntity.uuid,
          contentType,
          token
        );
      });
  }

  createOrUpdate(filepath, fileContent, contentType, experiment, token) {
    let pathparts = filepath.split('/');
    return this.ensurePath(
      pathparts,
      experiment,
      contentType,
      token
    ).then(file =>
      CollabConnector.instance.uploadContent(token, file.uuid, fileContent)
    );
  }

  createFolder(foldername, experiment, token) {
    return CollabConnector.instance.createFolder(token, experiment, foldername);
  }

  getCollabId(token, contextId) {
    return contextId
      ? CollabConnector.instance.getContextIdCollab(token, contextId)
      : q.when(this.config.collabId);
  }

  listExperiments(token, userId, contextId) {
    return this.getCollabId(token, contextId)
      .then(collabId =>
        CollabConnector.instance.getCollabEntity(token, collabId)
      )
      .then(entity =>
        CollabConnector.instance.projectFolders(token, entity.uuid)
      );
  }

  createExperiment(newExperiment, token, userId, contextId) {
    return this.getCollabId(token, contextId)
      .then(collabId =>
        CollabConnector.instance.getCollabEntity(token, collabId)
      )
      .then(entity =>
        CollabConnector.instance.createFolder(token, entity.uuid, newExperiment)
      );
  }
}

module.exports = Storage;
