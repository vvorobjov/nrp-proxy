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
  uuid = require('uuid/v4'),
  path = require('path'),
  BaseStorage = require('../BaseStorage.js'),
  Authenticator = require('./Authenticator.js');

//mocked in the tests thus non const
let utils = require('./utils.js'),
  DB = require('./DB.js'),
  fs = require('fs'),
  rmdir = require('rmdir');

class Storage extends BaseStorage {

  tokenHasAccessToPath(token, filename) {
    let experiment = filename.split('/')[0];
    return DB.instance.experiments.findOne({ token: token, experiment: experiment })
      .then(res => res || q.reject(Authenticator.AUTHORIZATION_ERROR));
  }

  calculateFilePath(experiment, filename) {
    //let dirPath = path.join(utils.storagePath, experiment);
    let filePath = path.join(utils.storagePath, filename);
    if (!filePath.startsWith(utils.storagePath))
      //file name attempts at going somewhere else (ie '../../someosfile' or '/usr/someimportantfile')
      return q.reject(Authenticator.AUTHORIZATION_ERROR);
    return filePath;
  }

  listFiles(experiment, token) {
    return this.tokenHasAccessToPath(token, experiment)
      .then(() => this.calculateFilePath('', experiment))
      .then(fullpath => q.all([fullpath, q.denodeify(fs.readdir)(fullpath)]))
      .then(([fullpath, files]) => files.map(f => {
        let stat = fs.statSync(path.join(fullpath, f));
        return {
          name: f,
          uuid: path.join(experiment, f),
          size: stat.size,
          type: stat.isDirectory() ? 'folder' : 'file'
        };
      }));
  }

  getFile(filename, experiment, token, byname) {
    if (byname)
      filename = path.join(experiment, filename);
    let basename = path.basename(filename);
    return this.tokenHasAccessToPath(token, filename)
      .then(() => this.calculateFilePath(experiment, filename))
      .then(filePath => q.denodeify(fs.readFile)(filePath))
      .then(filecontent => ({
        uuid: filename,
        contentDisposition: `attachment; filename=${basename}`,
        body: filecontent
      }))
      .catch(e => q.reject({ code: 204, msg: `Could not find file ${filename}` }));
  }

  deleteFile(filename, experiment, token, byname) {
    if (byname)
      filename = path.join(experiment, filename);

    return this.tokenHasAccessToPath(token, filename)
      .then(() => this.calculateFilePath(experiment, filename))
      .then(filePath => q.denodeify(fs.unlink)(filePath))
      .catch(e => q.reject({ code: 204, msg: `Could not find file ${filename}` }));
  }

  deleteFolder(foldername, experiment, token, byname = false) {
    return this.tokenHasAccessToPath(token, foldername)
      .then(() => this.calculateFilePath(experiment, foldername))
      .then(filePath => q.denodeify(rmdir)(filePath))
      .then(() => { });
  }

  createOrUpdate(filename, fileContent, contentType, experiment, token) {
    filename = path.join(experiment, filename);
    return this.tokenHasAccessToPath(token, filename)
      .then(() => this.calculateFilePath(experiment, filename))
      .then(filePath => q.denodeify(fs.writeFile)(filePath, fileContent));
  }

  createFolder(foldername, experiment, token) {
    const fullFoldername = path.join(experiment, foldername);
    return this.tokenHasAccessToPath(token, fullFoldername)
      .then(() => this.calculateFilePath(experiment, fullFoldername))
      .then(folderpath => q.denodeify(fs.mkdir)(folderpath))
      .then(() => ({
        uuid: fullFoldername,
        'entity_type': 'folder',
        name: foldername
      }));
  }

  listExperiments(token, contextId) {
    return DB.instance.experiments.find({ token: token })
      .then(res => res.map(f => ({
        uuid: f.experiment,
        name: f.experiment
      })));
  }

  createExperiment(newExperiment, token) {
    return DB.instance.experiments.findOne({ experiment: newExperiment })
      .then(existingExp => {
        if (existingExp)
          return q.reject('Experiment already exists');

        return DB.instance.experiments.insert({ token: token, experiment: newExperiment })
          .then(() => this.calculateFilePath('', newExperiment))
          .then(filePath => q.denodeify(fs.mkdir)(filePath))
          .then(() => ({ 'uuid':newExperiment }));
      });
  }
}

module.exports = Storage;