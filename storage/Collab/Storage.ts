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

import { response } from 'express';
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
          isFolder ? 'folder' : 'file')
    );
  }

  deleteFile(filename, experiment, token, userId, byname = false) {
    return this.deleteEntity(
      filename,
      experiment,
      token,
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

  async deleteExperiment(experimentPath, exp, token, userID) {

    await this.deleteEntity(experimentPath, exp, token, false, true);

    // remove the experiment from the bucket configuration file
    const bucket = experimentPath.split('/')[0];
    const expName = experimentPath.split('/')[1];

    const bucketExperimentConfig = await this.getBucketNrpExperimentsConfig(bucket, token)
      .then(response => {
        console.info(typeof(response.experiments));
        return response.experiments;
        });

    const newExperiments: string[] = [];

    bucketExperimentConfig.map(exp => {
      if (!(exp.path === expName)) {
        console.info('keeping : ', exp.path);
        newExperiments.push(exp);
      } else {
        console.info(exp.path);
      }});

    await this.createOrUpdate(NRP_EXPERIMENTS_CONFIG_FILENAME,
      JSON.stringify({experiments: newExperiments}),
      String,
      bucket,
      token);
  }

  deleteFolder(foldername, experiment, token, userId, byname = false) {
    return this.deleteEntity(
      foldername,
      experiment,
      token,
      byname,
      true
    );
  }

  ensurePath(pathparts, parent, contentType, token) {
    const fileType = pathparts.length > 1 ? 'folder' : 'file';
    // console.info('ensurePath : ', pathparts);
    return CollabConnector.instance
      .bucketFolderContent(token, parent)
      .then(contents => {
        const foundEntity = contents.find(
          f => f.name === pathparts[0] && f.type === fileType
        );
        // console.info('ensurePath foundentity : ', foundEntity);
        if (foundEntity) return foundEntity;
        return { uuid : parent + pathparts };
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
      })
      .catch((error) => console.error());
  }

  createOrUpdate(filepath, fileContent, contentType, experiment, token) {
    const pathparts = filepath.split('/');
    console.info('createOrUpdate : ', typeof(fileContent) + ' | ' + experiment);
    return this.ensurePath(
      pathparts,
      experiment,
      contentType,
      token
    ).then(file =>
      CollabConnector.instance.uploadContent(token, file.uuid, fileContent)
    )
    .catch((error) => console.error());
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

    const collabs = await this.getNrpCollabsViaTag(token);
    const result: any[] = [];
    for (const collab of collabs) {
      try {
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

  async getNrpCollabsViaTag(token) {
    const tagsResponse = await CollabConnector.instance
                                                      .getJSON(CollabConnector.SEARCH_TAG_URL
                                                        + COLLAB_TAG_NRP_EXPERIMENTS, token);
    const collabs: string[] = [];
    for (const pageSummary of tagsResponse.pageSummaries) {
      const collabName = pageSummary.space.split('.')[1];
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

  }

  decorateExpConfigurationWithAttribute(attribute, value, expConf) {
    try {
      const expConfigJson = JSON.parse(expConf);
      expConfigJson[attribute] = value;
      const expConfString: string = new X2JS().xml2js(expConf);
      return  JSON.stringify(expConfigJson);
    } catch (error) {
      console.info('Not able to decorate the configuration');
      return expConf;
    }
  }

  async copyExperiment(experiment, token, contextId) {
    const experimentsList = await this.listExperiments(token, contextId, null);
    console.info(experiment);

    const copiedExpName = utils.generateUniqueExperimentId(
      experiment,
      0,
      experimentsList.map(exp => exp.name)
    );

    const parent = copiedExpName.split('/')[0];
    const expName = copiedExpName.split('/')[1];

    await CollabConnector.instance.copyFolder(token, parent, expName, experiment).then((response) => console.info(response));

    // console.info('creating exp : ', copiedExpName);
    /* await this.listFiles(experiment, token)
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
              }))); */

    // Decorate the experiment configuration with the cloneDate attribute, with a timeout to make sure that the
    // new configuration is available.

    setTimeout(async () => {
    const experimentConfiguration = await this.getFile('simulation_config.json', copiedExpName, token, null, true);
    // console.info('configuration of the created exp : ', experimentConfiguration);
    let decoratedExpConf = this.decorateExpConfigurationWithAttribute('cloneDate', utils.getCurrentTimeAndDate(), experimentConfiguration.body);
    decoratedExpConf = this.decorateExpConfigurationWithAttribute('SimulationName', copiedExpName, decoratedExpConf);
    console.info('decoratedExpCOnf type : ' , typeof(decoratedExpConf));
    await this.createOrUpdate('simulation_config.json',
      decoratedExpConf,
      experimentConfiguration.contentType,
      copiedExpName,
      token);
      }, 1000);

    // Update the nrp_experiments.json file of the bucket listing the available experiments;
    const bucketExperimentConfig = await this.getBucketNrpExperimentsConfig(parent, token)
      .then(response => {
        response.experiments.push({type : 'folder', path : copiedExpName});
        return response;
        });

    const updatedbucketExperimentConfig = JSON.stringify(bucketExperimentConfig);
    console.info(typeof(updatedbucketExperimentConfig));
    await this.createOrUpdate(NRP_EXPERIMENTS_CONFIG_FILENAME,
      updatedbucketExperimentConfig,
      String,
      parent,
      token);

    return {
      clonedExp: copiedExpName,
      originalExp: experiment
    };
  }

  async renameExperiment(experimentPath, newName, token, userId) {

    console.info(experimentPath);
    const parent = experimentPath.split('/')[0];
    const expName = experimentPath.split('/')[1];

    console.info('rewritting the simulation_config.json...');
    const experimentConfiguration = await this.getFile('simulation_config.json', experimentPath, token, null, true);
    await this.createOrUpdate('simulation_config.json',
    experimentConfiguration.body,
    experimentConfiguration.contentType,
    experimentPath,
    token);
    const decoratedExpConf = this.decorateExpConfigurationWithAttribute('SimulationName', experimentPath, experimentConfiguration.body);
    console.info('decoratedExpCOnf type : ' , typeof(decoratedExpConf));
    await this.createOrUpdate('simulation_config.json',
      decoratedExpConf,
      experimentConfiguration.contentType,
      experimentPath,
      token);

    console.info('renaming the experiment folder...');
    await (q.when(experimentPath))
      .then(uuid => {
        console.info(uuid);
        uuid && CollabConnector.instance.renameBucketEntity(token, parent, uuid, newName, 'folder'); });

    return await this.getBucketNrpExperimentsConfig(parent, token)
    .then(response => response.experiments.filter(exp => exp.path !== expName))
    .then(response => {response.push({type : 'folder', path : newName}); })
    .then(response => {this.createOrUpdate(NRP_EXPERIMENTS_CONFIG_FILENAME,
      JSON.stringify(response),
      experimentConfiguration.contentType,
      parent + '/',
      token); });
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
    throw 'not implemented';
  }

  async createUniqueExperimentId(token, userId, expPath, contextId) {
    throw 'not implemented';
  }

  insertExperimentInDB(userId, foldername) {
    throw 'not implemented';
  }

  getStoragePath() {
    throw 'not implemented';
  }

  createOrUpdateKgAttachment(filename, content) {
    throw 'not implemented';
  }

  getKgAttachment(filename) {
    throw 'not implemented';
  }

  unzip(filename, fileContent, experiment, userId) {
    throw 'not implemented';
  }
}
