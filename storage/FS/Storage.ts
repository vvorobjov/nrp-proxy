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

import { unionWith } from 'lodash';
import X2JS from 'x2js';
import Authenticator from '../BaseAuthenticator';
import BaseStorage from '../BaseStorage';

const q = require('q'),
  path = require('path'),
  mime = require('mime-types'),
  _ = require('lodash'),
  tmp = require('tmp'),
  pd = require('pretty-data').pd,
  USER_DATA_FOLDER = 'USER_DATA',
  INTERNALS = ['FS_db', USER_DATA_FOLDER];

// mocked in the tests thus non const
// tslint:disable: prefer-const
let glob = q.denodeify(require('glob')),
  jszip = require('jszip'),
  DB = require('./DB').default,
  utils = require('./utils').default,
  fs = require('fs'),
  rmdir = require('rmdir'),
  fsExtra = require('fs-extra'),
  customModelAbsPath = path.join(utils.storagePath, USER_DATA_FOLDER);
// tslint:enable: prefer-const

export class Storage extends BaseStorage {

  userIdHasAccessToPath(userId, filename) {
    const experiment = filename.split('/')[0];
    return DB.instance.experiments
      .findOne({
        $or: [
          { $and: [{ token: userId, experiment }] },
          { $and: [{ experiment, shared_users: { $in: userId } }] },
          { $and: [{ experiment, shared_option: 'Public' }] }
        ]
      })
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
      // file name attempts at going somewhere else (ie '../../someosfile' or '/usr/someimportantfile')
      return q.reject(Authenticator.AUTHORIZATION_ERROR);
    return filePath;
  }

  listFiles(experiment, token, userId) {
    return this.userIdHasAccessToPath(userId, experiment)
      .then(() => this.calculateFilePath('', experiment))
      .then(fullpath => q.all([fullpath, q.denodeify(fs.readdir)(fullpath)]))
      .then(([fullpath, files]) =>
        files.map(f => {
          const stat = fs.statSync(path.join(fullpath, f));
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

  // finds an unused name for a new experiment in the form 'templatename_0'
  async createUniqueExperimentId(token, userId, dirname, contextId) {
    const expList = await this.listExperiments(token, userId, contextId, {
      all: true
    });
    return utils.generateUniqueExperimentId(dirname, 0, expList.map(exp => exp.name));
  }

  getFile(filename, experiment, token, userId, byname) {
    if (byname) filename = path.join(experiment, filename);
    const basename = path.basename(filename);
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

  listAllModels(modelType, userName) {
    return DB.instance.models
      .find({
        $or: [{ $and: [{ ownerName: userName }, { type: modelType }] },
        {
          $or: [
            { $and: [{ sharingOption: 'Public' }, { type: modelType }] },
            {
              $and: [
                { type: modelType },
                { sharingOption: 'Shared' }
              ]
            }
          ]
        }
        ]
      })
      .then(res => {
        if (typeof res !== 'undefined' && res) {
          return res.filter(element => {
            if (element.ownerName === userName)
              return true;
            else {
              if (typeof element.sharingUsers !== 'undefined' && res) {
                return element.sharingUsers.find(sharingUser => {
                  return sharingUser === userName;
                }) === userName;
              } else
                return true;
            }
          });
        }
      }
      )
      .then(res => {
        if (typeof res !== 'undefined' && res) {
          return res.map(f => ({
            name: f.name,
            path: f.path,
            ownerName: f.ownerName,
            type: f.type,
            isShared: ((f.sharingOption === 'Public' || f.sharingOption === 'Shared')
              && f.ownerName !== userName) ? true : false
          }));
        } else
          return [];
      }
      );
  }

  addUsertoSharingUserListinModel(modelType, modelName, userName) {
    return DB.instance.models
      .findOne({ $and: [{ name: modelName }, { type: modelType }] })
      .then(existingModel => {
        if (existingModel)
          return DB.instance.models.update(
            { _id: existingModel._id },
            { $addToSet: { sharingUsers: userName } }
          );
        return q.reject(`The model: ${modelName} does not exist in the Models database.`);
      });
  }

  listSharingUsersbyModel(modelType, modelName) {
    return DB.instance.models
      .findOne({ $and: [{ name: modelName }, { type: modelType }] })
      .then(res =>
        (res.sharingUsers ? res.sharingUsers : []));
  }

  updateSharedModelMode(modelType, modelName, modelsharingOption) {
    return DB.instance.models.update(
      { $and: [{ name: modelName }, { type: modelType }] },
      { $set: { sharingOption: modelsharingOption } }
    );
  }

  getModelSharingMode(modelType, modelName) {
    return DB.instance.models
      .findOne({ $and: [{ name: modelName }, { type: modelType }] })
      .then(res => (
        {
          sharingOption: (res.sharingOption ? res.sharingOption : 'Private')
        }
      ));
  }

  deleteSharingUserFromModel(modelType, modelName, userName) {
    if (userName === 'all')
      return DB.instance.models.update(
        { $and: [{ name: modelName }, { type: modelType }] },
        { $set: { sharingUsers: [] } },
        { multi: true }
      );
    else
      return DB.instance.models.update(
        { $and: [{ name: modelName }, { type: modelType }] },
        { $pull: { sharingUsers: { $in: [userName] } } }
      );
  }

  listSharedModels(modelType, userName) {
    return DB.instance.models
      .find({
        $and: [
          {
            sharingOption: { $ne: 'Private' }, type: modelType,
            $or: [
              { sharingUsers: { $in: userName } },
              { $and: [{ ownerName: { $ne: userName }, sharingOption: 'Public' }] }
            ]
          }
        ]
      })
      .then(res => res.map(f => ({ name: f.name, type: f.type, ownerName: f.ownerName, path: f.path })));
  }

  getModelPath(modelType, modelName) {
    return DB.instance.models
      .findOne({ $and: [{ name: modelName }, { type: modelType }] })
      .then(existingExp => {
        if (!existingExp) return q.reject(`The model: ${modelName} does not exist in the Models database.`);
        return existingExp.path;
      });
  }

  getModelFolder(modelType, modelName) {
    return DB.instance.models
      .findOne({ $and: [{ name: modelName }, { type: modelType }] })
      .then(existingExp => {
        if (!existingExp) return q.reject(`The model: ${modelName} does not exist in the Models database.`);
        return q.denodeify(fs.readFile)(path.join(customModelAbsPath, existingExp.path));
      });
  }

  async deleteCustomModel(modelType, modelName, userName): Promise<string> {
    const modelToDelete: { name: string, ownerId: string, type: string, path: string } | null =
      await DB.instance.models.findOne({ $and: [{ name: modelName }, { type: modelType }, { ownerName: userName }] });
    // if the model is not in the DB (weird) log the problem. At this point we could try to remove it from the FS
    // but maybe this would be undesired behaviour from the user side
    if (!modelToDelete) return q.reject(`The model: ${modelName} does not exist in the Models database.`);

    let deletionResult: number | null;
    try {
      // remove the custom model from the FS
      await q.denodeify(fs.unlink)(path.join(customModelAbsPath, modelToDelete.path));
      // remove model from DB
      deletionResult = await DB.instance.models.remove({ $and: [{ name: modelName }, { type: modelType }, { ownerName: userName }] });
      if (!deletionResult)
        return q.reject(`Could not delete the model ${modelName} from the Models database.`);
    } catch {
      // even if the model is not in the FS (cause it could have been manually removed)
      // still try to remove it from the DB
      await await DB.instance.models.remove({ $and: [{ name: modelName }, { type: modelType }, { ownerName: userName }] });
      // if the FS call failed, we log the problem
      return q.reject(`Could not find the model ${modelName} to remove in the user storage.`);
    }
    return q.resolve(`Succesfully deleted model ${modelName} from the user storage.`);
  }

  createCustomModel(model, zip) {
    return DB.instance.models
      .findOne({ $and: [{ name: model.name }, { type: model.type }] })
      .then(existingExp => {
        if (!existingExp)
          DB.instance.models.insert({
            ownerName: model.ownerName,
            name: model.name,
            type: model.type,
            path: model.path,
          });
        return q.denodeify(fs.writeFile)(path.join(customModelAbsPath, model.path), zip, {
              encoding: 'binary'
            });
      });
  }

  listModelsbyType(modelType) {
    return DB.instance.models
      .find({ type: modelType })
      .then(res =>
        res.map(f => ({
          name: f.name,
          path: f.path,
          ownerName: f.ownerName,
          type: f.type,
          fileName: path.basename(f.path)
        }))
      )
      .catch(() => []);
  }

  listUserModelsbyType(modelType, userId) {
    return DB.instance.models
      .find({ ownerName: userId, type: modelType })
      .then(res =>
        res.map(f => ({
          name: f.name,
          path: f.path,
          ownerId: f.ownerName,
          type: f.type
        }))
      )
      .catch(() => []);
  }

  deleteExperiment(foldername, experiment, token, userId) {
    return this.deleteFolder(foldername, experiment, token, userId)
      .then(() => {
        return DB.instance.experiments.remove({
          token: userId,
          experiment
        });
      })
      .then(() => undefined);
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
    userId,
    append = false
  ) {
    filename = path.join(experiment, filename);
    return this.userIdHasAccessToPath(userId, filename)
      .then(() => this.calculateFilePath(experiment, filename))
      .then(filePath =>
        fsExtra.ensureDir(path.dirname(filePath)).then(() => filePath)
      )
      .then(
        filePath =>
          append
            ? q.denodeify(fs.appendFile)(filePath, fileContent)
            : q.denodeify(fs.writeFile)(filePath, fileContent)
      );
  }

  createFolder(foldername, experiment, token, userId) {
    const fullFoldername = path.join(experiment, foldername);
    return (
      this.userIdHasAccessToPath(userId, fullFoldername)
        .then(() => this.calculateFilePath(experiment, fullFoldername))
        .then(folderpath => q.denodeify(fs.mkdir)(folderpath))
        // if folder exists no need to throw error
        .catch(err => (err.code === 'EEXIST' ? q.resolve() : q.reject(err)))
        .then(() => ({
          uuid: fullFoldername,
          entity_type: 'folder',
          name: foldername
        }))
    );
  }

  async listExperiments(token, userId, contextId, options = { all: false }): Promise<Array<{ uuid: string, name: string }>> {
    if (options.all) {
      const storageContents: string[] = await q.denodeify(fs.readdir)(utils.storagePath);
      const fsExperiments = storageContents.map(file => ({ uuid: file, name: file }));
      const dbExperiments = (await DB.instance.experiments.find()).map(e => ({ uuid: e.experiment, name: e.experiment }));
      return unionWith(
        fsExperiments,
        dbExperiments,
        (exp1, exp2) => exp1.uuid === exp2.uuid
      );

    } else {
      const userExperiments: Array<{ experiment: string }> = await DB.instance.experiments.find({ token: userId });
      return userExperiments.map(e => ({ uuid: e.experiment, name: e.experiment }));
    }
  }

  isDirectory(fileSystemEntry) {
    return fs
      .statSync(path.join(utils.storagePath, fileSystemEntry))
      .isDirectory();
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

  /*
  Decorates the experiment_configuration file with an extra xml attribute. The attribute
  is also checked for the __prefix value and if it exists in the .exc then we also
  add it in the atribute itself. The expConf is read as a buffer and converted into a utf8 string
  */
  decorateExpConfigurationWithAttribute(attribute, value, expConf) {
    const expConfString: string = new X2JS().xml2js(expConf.toString('utf8'));
    const exD: string = 'ExD';
    // only add the attribute if it is not there
    if (expConfString[exD].__prefix) {
      expConfString[exD][attribute] = {
        __prefix: expConfString[exD].__prefix,
        __text: value
      };
    } else {
      expConfString[exD][attribute] = value;
    }
    return pd.xml(new X2JS({ escapeMode: false }).js2xml(expConfString));
  }

  async copyExperiment(experiment, token, userId) {
    const experimentsList = await this.listExperiments(token, userId, null, {
      all: true
    });
    const copiedExpName = utils.generateUniqueExperimentId(
      experiment,
      0,
      experimentsList.map(exp => exp.name)
    );
    await this.createExperiment(copiedExpName, token, userId);
    await this.copyFolderContents(experiment, copiedExpName);

    // Decorate the experiment configuration with the cloneDate attribute
    const experimentConfiguration = await this.getFile('experiment_configuration.exc', copiedExpName, token, userId, true);
    const decoratedExpConf = this.decorateExpConfigurationWithAttribute('cloneDate', utils.getCurrentTimeAndDate(), experimentConfiguration.body);
    await this.createOrUpdate('experiment_configuration.exc',
      decoratedExpConf,
      experimentConfiguration.contentType,
      copiedExpName,
      token,
      userId);

    return {
      clonedExp: copiedExpName,
      originalExp: experiment
    };
  }

  getExperimentSharingMode(experimentID) {
    return DB.instance.experiments
      .findOne({ experiment: experimentID })
      .then(res => (
        {
          data: (res.shared_option ? res.shared_option : 'Private')
        }
      ));
  }

  updateSharedExperimentMode(experimentID, sharingOption) {
    return DB.instance.experiments.update(
      { experiment: experimentID },
      { $set: { shared_option: sharingOption } }
    );
  }

  listSharingUsersbyExperiment(experimentID) {
    return DB.instance.experiments
      .findOne({ experiment: experimentID })
      .then(res => (res.shared_users ? res.shared_users : []));
  }

  listExperimentsSharedByUsers(userId) {
    return DB.instance.experiments
      .find({
        $and: [
          {
            shared_option: { $ne: 'Private' },
            $or: [
              { shared_option: 'Shared' },
              { $and: [{ token: { $ne: userId }, shared_option: 'Public' }] }
            ]
          }
        ]
      })
      .then(res => {
        if (typeof res !== 'undefined' && res) {
          return res.filter(element => {
            if (element.shared_option === 'Shared') {
              if (element.shared_users)
                return element.shared_users.find(sharedUser => {
                  return sharedUser === userId;
              });
            } else
              return true;
          });
        }
      }
      )
      .then(res =>
        res.map(f => ({ uuid: f.experiment, name: f.experiment })));
  }

  deleteSharingUserFromExperiment(experimentId, userId) {
    if (userId === 'all')
      return DB.instance.experiments.update(
        { experiment: experimentId },
        { $set: { shared_users: [] } },
        { multi: true }
      );
    else
      return DB.instance.experiments.update(
        { experiment: experimentId },
        { $pull: { shared_users: { $in: [userId] } } }
      );
  }

  addUsertoSharingUserListinExperiment(newExperiment, userId) {
    return DB.instance.experiments
      .findOne({ experiment: newExperiment })
      .then(existingExp => {
        if (existingExp)
          return DB.instance.experiments.update(
            { _id: existingExp._id },
            { $addToSet: { shared_users: userId } }
          );
        return q.reject('Experiment does not exist');
      });
  }

  async copyFolderContents(experiment, destFolder) {
    // Filter out all the csv_records folders
    const filterFunc = (src, dest) => {
      return !dest.includes('/csv_records') && !dest.includes('/recordings');
    };
    return fsExtra.copySync(path.join(utils.storagePath, experiment), path.join(utils.storagePath, destFolder), { filter: filterFunc });
  }

  // Inserts the (non-registered) experiment folder <foldername> in the experiments database
  insertExperimentInDB(userId, foldername) {
    return DB.instance.experiments.insert({ token: userId,  experiment: foldername });
  }

  // Scans the user storage and
  // (1) inserts the non-registered experiments in the database,
  // (2) unregister deleted experiment folders from the database.
  // Returns the added and the deleted entries.
  // Note: only for local usage
  async scanStorage(userId: string): Promise<{addedFolders: string[], deletedFolders: string[]}> {
    const files = await q.denodeify(fs.readdir)(this.getStoragePath());
    const experimentFolders = files.filter(fileSystemEntry => this.isDirectory(fileSystemEntry))
    .filter(folder => INTERNALS.indexOf(folder) === -1);
    const addedFolders = await this.addNonRegisteredExperiments(userId, experimentFolders);
    const experiments = await DB.instance.experiments.find({ token: userId });
    const deletedExperiments = experiments.filter(entry => experimentFolders.indexOf(entry.experiment) === -1);
    await this.removeExperiments(deletedExperiments);
    const deletedFolders = deletedExperiments.map(entry => entry.experiment);
    return { addedFolders, deletedFolders };
  }

  async addNonRegisteredExperiments(userId: string, folders: string[]): Promise<string[]> {
    const addedFolders: string[] = [];
    const folderInsertions = folders.map(async (e: string) => {
      const found = await DB.instance.experiments.findOne({ experiment: e });
      if (found === null && INTERNALS.indexOf(e) === -1) {
        addedFolders.push(e);
        return DB.instance.experiments.insert({
          token: userId,
          experiment: e
        });
      }
    });
    await q.all(folderInsertions);
    return addedFolders;
  }

  async removeExperiments(experimentEntries) {
    const promises = experimentEntries.map(entry => DB.instance.experiments.remove({ token: entry.token, experiment: entry.experiment }));
    return await q.all(promises);
  }

 // Extracts a zip experiment folder to destFolderName
  async extractZip(zipContent, destFolderName) {
    const mapFile = async filepath => {
      if (path.parse(filepath).dir !== '' && filepath.substr(-1) !== path.sep) {
        const content = await zipContent.file(filepath).async('nodebuffer');
        filepath = filepath.substring(filepath.indexOf('/') + 1); // Removes the largest enclosing folder from the filepath
        const dest = path.join(utils.storagePath, destFolderName, filepath);
        if (!await fsExtra.exists(path.dirname(dest))) {
          await fsExtra.ensureDir(path.dirname(dest));
        }
        await fsExtra.writeFile(dest, content);
      }
    };
    const files = Object.keys(zipContent.files).map(mapFile);
    return q.all(files);
  }

  getStoragePath() {
    return utils.storagePath;
  }
}
