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

import BaseStorage from '../BaseStorage';
import utils from '../FS/utils';
import CollabConnector from './CollabConnector';

const q = require('q'),
  _ = require('lodash');

export class Storage extends BaseStorage {
  constructor(private config) {
    super();
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
    return this.deleteEntity(
      filename,
      experiment,
      token,
      userId,
      byname,
      false
    );
  }

  getModelFolder(modelPath, token, userId) {
    return this.getFile(modelPath.uuid, null, token, userId).then(
      res => res.body
    );
  }

  createCustomModel(modelType, modelData, userId, modelName, token, contextId) {
    return this.listExperiments(token, userId, contextId).then(folders => {
      const folder = _.find(folders, f => f.name === modelType);
      if (!folder) return q.reject(`Folder ${modelType} not found`);
      return this.createOrUpdate(
        modelName,
        modelData,
        'application/zip',
        folder.uuid,
        token
      );
    });
  }

  listCustomModels(customFolder, token, userId, contextId) {
    return this.listExperiments(token, userId, contextId)
      .then(folders => {
        const folder = _.find(folders, f => f.name === customFolder);
        if (!folder) return [];
        return CollabConnector.instance.folderContent(token, folder.uuid);
      })
      .then(files => files.map(f => ({ uuid: f.uuid, fileName: f.name })));
  }

  deleteExperiment(experiment, exp, token, userId) {
    return this.deleteEntity(experiment, exp, token, userId, false, true);
  }

  deleteFolder(foldername, experiment, token, userId, byname = false) {
    return this.deleteEntity(
      foldername,
      experiment,
      token,
      userId,
      byname,
      true
    );
  }

  ensurePath(pathparts, parent, contentType, token) {
    const fileType = pathparts.length > 1 ? 'folder' : 'file';
    return CollabConnector.instance
      .folderContent(token, parent)
      .then(contents => {
        const foundEntity = contents.find(
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
    const pathparts = filepath.split('/');
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

  copyExperiment(experiment, token, userId, contextId) {
    return this.listExperiments(token, userId, contextId).then(res => {
      const copiedExpName = utils.generateUniqueExperimentId(
        res.filter(exp => exp.uuid === experiment)[0].name,
        0,
        res.map(exp => exp.name)
      );
      return this.createExperiment(
        copiedExpName,
        token,
        userId,
        contextId
      ).then(copiedExp =>
        this.listFiles(experiment, token)
          .then(files => [
            files.map(file =>
              this.getFile(file.name, experiment, token, userId, true)
            ),
            files
          ])
          .then(([filesCont, files]) =>
            q
              .all(
                _.zip(filesCont, files).map(file =>
                  file[0].then(contents =>
                    this.createOrUpdate(
                      file[1].name,
                      contents.body,
                      file[1].contentType,
                      copiedExp.uuid,
                      token
                    )
                  )
                )
              )
              .then(() => ({
                clonedExp: copiedExp.uuid,
                originalExp: experiment
              }))
          )
      );
    });
  }

  listAllModels(modelType, userId) {
    throw 'not implemented';
  }

  addUsertoSharingUserListinModel(modelType, modelName, userId) {
    throw 'not implemented';
  }

  listSharingUsersbyModel(modelType, modelID) {
    throw 'not implemented';
  }

  updateSharedModelMode(modelType, modelID, sharingOption) {
    throw 'not implemented';
  }

  getModelSharingMode(modelType, modelID) {
    throw 'not implemented';
  }

  deleteSharingUserFromModel(modelType, modelID, userId) {
    throw 'not implemented';
  }

  listSharedModels(modelType, userId) {
    throw 'not implemented';
  }
  listUserModelsbyType(modelType, token, userId) {
    throw 'not implemented';
  }

  isDirectory(fileSystemEntry) {
    throw 'not implemented';
  }

  getExperimentSharingMode(experimentID) {
    throw 'not implemented';
  }

  updateSharedExperimentMode(experimentID, sharingOption) {
    throw 'not implemented';
  }

  listSharingUsersbyExperiment(experimentID) {
    throw 'not implemented';
  }

  listExperimentsSharedByUsers(userId) {
    throw 'not implemented';
  }

  deleteSharingUserFromExperiment(experimentId, userId) {
    throw 'not implemented';
  }

  addUsertoSharingUserListinExperiment(newExperiment, userId) {
    throw 'not implemented';
  }

  copyFolderContents(contents, destFolder) {
    throw 'not implemented';
  }

  async extractZip(zip, destFoldername) {
    throw('Not implemented.');
  }

  async createUniqueExperimentId(token, userId, expPath, contextId) {
    throw('Not implemented.');
  }

  insertExperimentInDB(userId, foldername) {
    throw('Not implemented.');
  }

  getStoragePath() {
    throw('Not implemented.');
  }

  createOrUpdateKgAttachment(filename, content) {
    throw('Not implemented.');
  }

  getKgAttachment(filename) {
    throw ('Not implemented.');
  }

  unzip(filename, fileContent, experiment, userId) {
    throw ('Not implemented.');
  }
}
