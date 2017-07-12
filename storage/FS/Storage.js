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
  DB = require('./DB.js'), fs = require('fs');

class Storage extends BaseStorage {

  tokenHasAccessToExperiment(token, experiment) {
    return DB.instance.experiments.findOne({ token: token, experiment: experiment })
      .then(res => res || q.reject(Authenticator.AUTHORIZATION_ERROR));
  }

  calculateFilePath(experiment, filename) {
    let dirPath = path.join(utils.storagePath, experiment);
    let filePath = path.join(dirPath, filename);
    if (!filePath.startsWith(dirPath))
      //file name attempts at going somewhere else (ie '../../someosfile' or '/usr/someimportantfile')
      return q.reject(Authenticator.AUTHORIZATION_ERROR);
    return filePath;
  }

  listFiles(experiment, token) {
    return this.tokenHasAccessToExperiment(token, experiment)
      .then(() => q.denodeify(fs.readdir)(path.join(utils.storagePath, experiment)));
  }

  getFile(filename, experiment, token) {
    return this.tokenHasAccessToExperiment(token, experiment)
      .then(() => this.calculateFilePath(experiment, filename))
      .then(filePath => q.denodeify(fs.readFile)(filePath));
  }

  deleteFile(filename, experiment, token) {
    return this.tokenHasAccessToExperiment(token, experiment)
      .then(() => this.calculateFilePath(experiment, filename))
      .then(filePath => q.denodeify(fs.unlink)(filePath));
  }

  createOrUpdate(filename, fileContent, contentType, experiment, token) {
    return this.tokenHasAccessToExperiment(token, experiment)
      .then(() => this.calculateFilePath(experiment, filename))
      .then(filePath => q.denodeify(fs.writeFile)(filePath, fileContent));
  }

  listExperiments(token) {
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
          .then(() => this.calculateFilePath(newExperiment, ''))
          .then(filePath => q.denodeify(fs.mkdir)(filePath))
          .then(() => newExperiment);
      });
  }
}

module.exports = Storage;