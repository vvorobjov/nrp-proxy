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

import X2JS from 'x2js';
import BaseStorage from '../BaseStorage';
import utils from '../FS/utils';
import CollabConnector from './CollabConnector';

const q = require('q'),
  pd = require('pretty-data').pd,
  _ = require('lodash');

const NRP_EXPERIMENTS_CONFIG_FILENAME = 'nrp-experiments.json';
const COLLAB_DESCRIPTION_NRP_INDICATOR = 'CONTAINS NRP EXPERIMENTS (do not remove this line!)';
const COLLAB_TAG_NRP_EXPERIMENTS = 'NRP-Experiments';

export class Storage extends BaseStorage {
  downloadingExperiment: boolean; // for testing

  constructor(private config) {
    super();

    this.downloadingExperiment = false; // for testing
  }

  async listFiles(experiment, token) {
    return CollabConnector.instance.bucketFolderContent(
      token,
      decodeURIComponent(experiment)
    );
  }

  getFileUuid(filename, experiment, token) {
    return this.listFiles(experiment, token)
      .then(files => files.filter(f => f.name === filename))
      .then(files => (files.length === 0 ? null : files[0].uuid));
  }

  async getFile(filename, experiment, token, userId, byname = false) {
    return (byname
      ? this.getFileUuid(filename, experiment, token)
      : q.when(filename)
    )
      .then(uuid =>
        q.all([
          uuid,
          uuid &&
            CollabConnector.instance.getBucketFile(uuid, token, {
              encoding: null
            })
        ])
      )
      .then(([uuid, content]) =>
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
        CollabConnector.instance.deleteBucketEntity(
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

  async getModelZip(modelType, modelName, userId, token) {
    return this.getFile(modelType + '/' + modelName, null, token, userId).then(
      res => res.body);
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
        return CollabConnector.instance.bucketFolderContent(token, folder.uuid);
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
      .bucketFolderContent(token, parent)
      .then(contents => {
        const foundEntity = contents.find(
          f => f.name === pathparts[0] && f.type === fileType
        );
        console.info(parent);
        if (foundEntity) return foundEntity;
        return fileType === 'file'
          ? CollabConnector.instance.copyFile(
              token,
              parent,
              parent,
              pathparts[0],
              contentType
            )
          : CollabConnector.instance.createFolder(token, parent, pathparts[0], pathparts[0]);
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
    console.info('createOrUpdate : ', experiment);
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
    return CollabConnector.instance.createFolder(token, experiment, foldername, experiment);
  }

  getCollabId(token, contextId) {
    console.info(this.config.collabId);
    return contextId
      ? CollabConnector.instance.getContextIdCollab(token, contextId)
      : q.when(this.config.collabId);
  }

  async getCollabs(token, filterOptions) {
    let urlGetCollabs =
      CollabConnector.COLLAB_API_URL + '?limit=99999';
    for (const prop in filterOptions) {
      if (Object.prototype.hasOwnProperty.call(filterOptions, prop)) {
        urlGetCollabs += '&' + prop + '=' + filterOptions[prop];
      }
    }
    console.info(urlGetCollabs);
    const collabs = await CollabConnector.instance.getJSON(urlGetCollabs, token);
    return collabs;
  }

  /**
   * Only use to check collabs for experiment files and (in case of experiments) for collab description indicator line to be present
   * @param filterOptions
   * @param token
   */
  async validateNrpCollabs(filterOptions, token) {
    const collabs = await this.getCollabs(token, filterOptions);

    for (const collab of collabs) {
      try {
        const bucketContent = await CollabConnector.instance.bucketFolderContent(
          token,
          collab.name
        );
        if (this.bucketHasNrpExperiments(bucketContent) && !this.isNrpCollab(collab)) {
          // TODO
          console.warn('TODO: implement validation of collab experiment setup');
        }
      } catch (error) {
        console.warn(
          'Can not access collab "' + collab.name + '": ' + error
        );
      }
    }
  }

  isNrpCollab(collab) {
    /*console.info('isNrpCollab');
    console.info(collab);*/
    return collab.description.includes(COLLAB_DESCRIPTION_NRP_INDICATOR);
  }

  async listExperiments(token, userId, contextId) {
    return await this.listExperimentsWithFilterOptions(token, {public: 'true', admin: 'true'});
    // the filter options can be found at
    // https://wiki.ebrains.eu/bin/view/Collabs/the-collaboratory/Documentation%20Wiki/API/
    // for the v1/collabs request
  }

  /**
   * See https://wiki.ebrains.eu/bin/view/Collabs/the-collaboratory/Documentation%20Wiki/API/ for documentation
   * @param token User access token
   * @param collabFilterOptions Object with filter options following API
   * @returns List of experiments
   */
  async listExperimentsWithFilterOptions(token, collabFilterOptions) {
    /*let urlGetCollabs =
      CollabConnector.COLLAB_API_URL + '?limit=99999';
    for (const prop in options) {
      if (Object.prototype.hasOwnProperty.call(options, prop)) {
        urlGetCollabs += '&' + prop + '=' + options[prop];
      }
    }
    const collabs = await CollabConnector.instance.getJSON(urlGetCollabs, token);*/

    const collabs = await this.getNrpCollabsViaTag(token);
    // const collabs = await this.getCollabs(token, collabFilterOptions);
    // console.info(['listExperiments() - collabs:', collabs]);
    // console.info(collabs);
    const result: any[] = [];
    for (const collab of collabs) {
      try {
        // console.info("Collab for nrp : ", collab);
        const experimentsConfig = await this.getBucketNrpExperimentsConfig(
          collab,
          token
        );
        experimentsConfig.experiments &&
          experimentsConfig.experiments.filter(experiment => experiment)
            .forEach(experiment => {
            if (experiment.type === 'folder') {
              // TODO: exclude zipped for now, viable later?
              result.push({
                uuid: encodeURIComponent(collab + '/' + experiment.path),
                name: encodeURIComponent(collab + '/' + experiment.path)
              });
            }
          });
      } catch (error) {
        /*console.warn(
          'Can not access collab data proxy for "' + collab.name + '"'
        );*/
      }
    }
    // console.info(['listExperiments() - result:', result]);
    return result;
  }

  bucketHasNrpExperiments(bucketContent) {
    return (
      bucketContent &&
      bucketContent.some(
        object => object.name === NRP_EXPERIMENTS_CONFIG_FILENAME
      )
    );
  }

  async getNrpCollabsViaTag(token) {
    const tagsResponse = await CollabConnector.instance.getJSON('https://wiki.ebrains.eu/rest/wikis/xwiki/tags/' + COLLAB_TAG_NRP_EXPERIMENTS, token);
    // console.info('##### tags:');
    const collabs: string[] = [];
    for (const pageSummary of tagsResponse.pageSummaries) {
      const collabName = pageSummary.space.split('.')[1];
      // console.info(pageSummary);
      collabs.push(collabName);
    }
    return collabs;
  }

  async getBucketNrpExperimentsConfig(bucketName, token) {

    const fileUUID = bucketName + '/' + NRP_EXPERIMENTS_CONFIG_FILENAME;

    const experimentConfigFile: any = await CollabConnector.instance.getBucketFile(
      fileUUID,
      token,
      undefined
    );
    return JSON.parse(experimentConfigFile);
  }

  createExperiment(newExperiment, experiment, token, contextId) {
    console.info(token);
    const parent = newExperiment.split('/')[0];
    const expName = newExperiment.split('/')[1];
    return CollabConnector.instance.createFolder(token, parent, expName, experiment);

   /*  return this.getCollabId(token, contextId)
      .then(collabId => {
        console.info(collabId);
        CollabConnector.instance.getCollabEntity(token, collabId)}
      )
      .then(entity => {
        console.info(entity);
        CollabConnector.instance.createFolder(token, entity.uuid, newExperiment)}
      ); */
  }

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

  async copyExperiment(experiment, token, contextId) {
    const experimentsList = await this.listExperiments(token, contextId, null);
    const copiedExpName = utils.generateUniqueExperimentId(
      experiment,
      0,
      experimentsList.map(exp => exp.name)
    );

    await this.createExperiment(copiedExpName, experiment, token, contextId);

    // console.info('creating exp : ', copiedExpName);
    await this.listFiles(experiment, token)
          .then(files =>  q.all([
            files.map(file =>
              this.getFile(file.name, experiment, token, null, true)
            ),
            files
          ]))
          .then(([filesCont, files]) =>
            q
              .all(
                _.zip(filesCont, files).map(file =>
                  file[0].then(contents => {
                    this.createOrUpdate(
                      file[1].name,
                      contents.body,
                      file[1].contentType,
                      copiedExpName,
                      token
                    ); }
                  )
                )
              )
              .then(() => ({
                clonedExp: copiedExpName,
                originalExp: experiment
              })));

    // console.info('copying exp folder');

    // Decorate the experiment configuration with the cloneDate attribute
    const experimentConfiguration = await this.getFile('simulation_config.json', copiedExpName, token, null, true);
    console.info('configuration of the created exp : ', experimentConfiguration);
    const decoratedExpConf = this.decorateExpConfigurationWithAttribute('cloneDate', utils.getCurrentTimeAndDate(), experimentConfiguration.body);
    await this.createOrUpdate('experiment_configuration.json',
      decoratedExpConf,
      experimentConfiguration.contentType,
      copiedExpName,
      token);

    return {
      clonedExp: copiedExpName,
      originalExp: experiment
    };
  }

  renameExperiment(experimentPath, newName, token, userId) {
    return this.getFile(userId, experimentPath, token, userId, true)
      .then(expConfig => {
        return JSON.parse(expConfig.body);
      })
      .then(expConfig => {
        expConfig.SimulationName = newName;
        this.createOrUpdate(
          newName,
          JSON.stringify(expConfig, null, 4),
          'application/json',
          experimentPath,
          token
         );
      })
      .then(() => undefined);
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
    // shared experiments not returned in Collab mode
    return [];
    // return await this.listExperimentsWithFilterOptions(token, {visibility: 'public'});
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
    throw 'Not implemented.';
  }

  async createUniqueExperimentId(token, userId, expPath, contextId) {
    throw 'Not implemented.';
  }

  insertExperimentInDB(userId, foldername) {
    throw 'Not implemented.';
  }

  getStoragePath() {
    throw 'Not implemented.';
  }

  createOrUpdateKgAttachment(filename, content) {
    throw 'Not implemented.';
  }

  getKgAttachment(filename) {
    throw 'Not implemented.';
  }

  unzip(filename, fileContent, experiment, userId) {
    throw 'Not implemented.';
  }
}
