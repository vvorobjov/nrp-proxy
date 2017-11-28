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

class BaseStorage {
  constructor() {
    if (new.target === BaseStorage)
      throw new TypeError('BaseStorage is an abstract class');
  }
  /*eslint-disable no-unused-vars*/
  listFiles(experiment, token, userId) {
    throw 'not implemented';
  }
  getFile(filename, experiment, token, userId, byname) {
    throw 'not implemented';
  }
  deleteFile(filename, experiment, token, userId, byname) {
    throw 'not implemented';
  }
  deleteFolder(foldername, experiment, token, userId, byname = false) {
    throw 'not implemented';
  }
  createFolder(foldername, experiment, token, userId) {
    throw 'not implemented';
  }

  deleteExperiment(experimentName, parentDir, token, userId) {
    throw 'not implemented';
  }

  createOrUpdate(
    filename,
    fileContent,
    contentType,
    experiment,
    token,
    userId
  ) {
    throw 'not implemented';
  }

  getCustomModel(modelPath, token, userId) {
    throw 'not implemented';
  }

  listCustomModels(customFolder, token, userId, contextId) {
    throw 'not implemented';
  }
  listExperiments(token, userId, contextId, options) {
    throw 'not implemented';
  }
  createExperiment(newExperiment, token, userId, contextId) {
    throw 'not implemented';
  }
  /*eslint-enable no-unused-vars*/
}

module.exports = BaseStorage;
