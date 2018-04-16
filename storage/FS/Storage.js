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
  BaseStorage = require('../BaseStorage.js'),
  Authenticator = require('./Authenticator.js'),
  mime = require('mime-types'),
  USER_DATA_FOLDER = 'USER_DATA';

//mocked in the tests thus non const
let utils = require('./utils.js'),
  DB = require('./DB.js'),
  fs = require('fs'),
  rmdir = require('rmdir'),
  fsExtra = require('fs-extra');

class Storage extends BaseStorage {
  userIdHasAccessToPath(userId, filename) {
    let experiment = filename.split('/')[0];
    return DB.instance.experiments
      .findOne({ token: userId, experiment: experiment })
      .then(res => res || q.reject(Authenticator.AUTHORIZATION_ERROR));
  }

  calculateFilePath(experiment, filename, model = false) {
    let filePath;
    if (model) {
      filePath = path.join(
        utils.storagePath,
        USER_DATA_FOLDER,
        experiment,
        filename
      );
    } else filePath = path.join(utils.storagePath, filename);
    if (!filePath.startsWith(utils.storagePath))
      //file name attempts at going somewhere else (ie '../../someosfile' or '/usr/someimportantfile')
      return q.reject(Authenticator.AUTHORIZATION_ERROR);
    return filePath;
  }

  listFiles(experiment, token, userId) {
    return this.userIdHasAccessToPath(userId, experiment)
      .then(() => this.calculateFilePath('', experiment))
      .then(fullpath => q.all([fullpath, q.denodeify(fs.readdir)(fullpath)]))
      .then(([fullpath, files]) =>
        files.map(f => {
          let stat = fs.statSync(path.join(fullpath, f));
          return {
            name: f,
            uuid: path.join(experiment, f),
            size: stat.size,
            type: stat.isDirectory() ? 'folder' : 'file',
            modifiedOn: stat.mtime
          };
        })
      );
  }

  getFile(filename, experiment, token, userId, byname) {
    if (byname) filename = path.join(experiment, filename);
    let basename = path.basename(filename);
    return this.userIdHasAccessToPath(userId, filename)
      .then(() => this.calculateFilePath(experiment, filename))
      .then(filePath => q.denodeify(fs.readFile)(filePath))
      .then(filecontent => {
        return {
          uuid: filename,
          contentType: mime.lookup(filename) || 'text/plain',
          contentDisposition: `attachment; filename=${basename}`,
          body: filecontent
        };
      })
      .catch(() =>
        q.reject({ code: 204, msg: `Could not find file ${filename}` })
      );
  }

  deleteFile(filename, experiment, token, userId, byname) {
    if (byname) filename = path.join(experiment, filename);

    return this.userIdHasAccessToPath(userId, filename)
      .then(() => this.calculateFilePath(experiment, filename))
      .then(filePath => q.denodeify(fs.unlink)(filePath))
      .catch(() =>
        q.reject({ code: 204, msg: `Could not find file ${filename}` })
      );
  }

  getCustomModel(modelPath) {
    return q
      .resolve(path.join(USER_DATA_FOLDER, modelPath))
      .then(relFolderName => this.calculateFilePath('', relFolderName))
      .then(folderName => q.denodeify(fs.readFile)(folderName));
  }

  createCustomModel(modelType, modelData, userId, modelName) {
    return q
      .resolve(
        this.calculateFilePath(path.join(userId, modelType), modelName, true)
      )
      .then(filePath =>
        q.denodeify(fs.writeFile)(filePath, modelData, { encoding: 'binary' })
      );
  }

  listCustomModels(customFolder, token, userId) {
    let customModelsRePath = path.join(userId, customFolder);
    return q
      .resolve(path.join(USER_DATA_FOLDER, customModelsRePath))
      .then(relFolderName => this.calculateFilePath('', relFolderName))
      .then(folderName => q.denodeify(fs.readdir)(folderName))
      .then(files => files.map(f => path.join(customModelsRePath, f)))
      .catch(() => []);
  }

  deleteExperiment(foldername, experiment, token, userId) {
    return this.deleteFolder(foldername, experiment, token, userId)
      .then(() => {
        return DB.instance.experiments.remove({
          token: userId,
          experiment: experiment
        });
      })
      .then(() => {});
  }

  deleteFolder(foldername, experiment, token, userId) {
    return this.userIdHasAccessToPath(userId, foldername)
      .then(() => this.calculateFilePath(experiment, foldername))
      .then(filePath => q.denodeify(rmdir)(filePath));
  }

  createOrUpdate(
    filename,
    fileContent,
    contentType,
    experiment,
    token,
    userId
  ) {
    filename = path.join(experiment, filename);
    return this.userIdHasAccessToPath(userId, filename)
      .then(() => this.calculateFilePath(experiment, filename))
      .then(filePath => q.denodeify(fs.writeFile)(filePath, fileContent));
  }

  createFolder(foldername, experiment, token, userId) {
    const fullFoldername = path.join(experiment, foldername);
    return this.userIdHasAccessToPath(userId, fullFoldername)
      .then(() => this.calculateFilePath(experiment, fullFoldername))
      .then(folderpath => q.denodeify(fs.mkdir)(folderpath))
      .then(() => ({
        uuid: fullFoldername,
        entity_type: 'folder',
        name: foldername
      }));
  }

  listExperiments(token, userId, contextId, options = {}) {
    return options.all
      ? q.denodeify(fs.readdir)(utils.storagePath).then(res =>
          res.map(file => ({ uuid: file, name: file }))
        )
      : DB.instance.experiments
          .find({ token: userId })
          .then(res => this.removeNonExistingExperiment(res, userId))
          .then(res =>
            res.map(f => ({ uuid: f.experiment, name: f.experiment }))
          );
  }

  removeNonExistingExperiment(experiments, userId) {
    return experiments
      .map(f => {
        if (!fs.existsSync(path.join(utils.storagePath, f.experiment))) {
          DB.instance.experiments.remove({
            token: userId,
            experiment: f.experiment
          });
          f = undefined;
        }
        return f;
      })
      .filter(item => item != undefined);
  }

  createExperiment(newExperiment, token, userId) {
    return DB.instance.experiments
      .findOne({ experiment: newExperiment })
      .then(existingExp => {
        if (existingExp) return q.reject('Experiment already exists');

        return DB.instance.experiments
          .insert({ token: userId, experiment: newExperiment })
          .then(() => this.calculateFilePath('', newExperiment))
          .then(filePath => q.denodeify(fs.mkdir)(filePath))
          .then(() => ({ uuid: newExperiment }));
      });
  }

  copyExperiment(experiment, token, userId) {
    return this.listExperiments(token, userId, null, {
      all: true
    }).then(res => {
      var copiedExpName = utils.generateUniqueExperimentId(
        experiment,
        0,
        res.map(exp => exp.name)
      );
      return this.createExperiment(copiedExpName, token, userId)
        .then(() => this.listFiles(experiment, token, userId))
        .then(res =>
          this.copyFolderContents(res, copiedExpName).then(() => ({
            clonedExp: copiedExpName,
            originalExp: experiment
          }))
        );
    });
  }

  copyFolderContents(contents, destFolder) {
    return q.all(
      contents.map(item =>
        fsExtra.copy(
          this.calculateFilePath('', item.uuid),
          this.calculateFilePath('', path.join(destFolder, item.name))
        )
      )
    );
  }
}

module.exports = Storage;
