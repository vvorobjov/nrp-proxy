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

import e from 'express';
import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import { pd } from 'pretty-data';
import q from 'q';
import X2JS from 'x2js';
import { File } from '../storage/BaseStorage';
import StorageRequestHandler from '../storage/requestHandler';
import * as storageConsts from '../storage/StorageConsts';
import ConfigurationManager from '../utils/configurationManager';

const glob = q.denodeify(require('glob')),
  xmlFormat = xml => pd.xml(xml);

export default class ExperimentServiceFactory {
  constructor(
    private storageRequestHandler,
    private config,
    private proxyRequestHandler
  ) {}

  createExperimentService(experimentId, contextId, template?) {
    if (template) {
      return new TemplateExperimentService(
        experimentId,
        contextId,
        this.config,
        this.proxyRequestHandler
      );
    } else {
      return new CloneExperimentService(
        experimentId,
        contextId,
        this.config,
        this.storageRequestHandler
      );
    }
  }
}

const FILE_TYPE = {
  BRAIN: 'BRAIN',
  SM: 'SM',
  TF: 'TF'
};

const V4_SIM_CONFIG_FILENAME = '*.json';
const V4_FILE_TYPE = {
  JSON: 'JSON'
};

abstract class BaseExperimentService {
  constructor(protected experimentId, protected contextId, protected config) {}

  async getSimConfigV4() {
    const configFile = await this.getFile(
      storageConsts.defaultConfigName,
      V4_FILE_TYPE.JSON
    );
    try {
      const config = JSON.parse(configFile.toString());
      if (config.cloneDate) {
        config.cloneDate = config.cloneDate.replace(/T/, ' ');
      }
      return config;
    } catch {
      return { SimulationName: 'Experiment with corrupted ' + storageConsts.defaultConfigName };
    }
  }

  getTags(strTags) {
    return strTags ? strTags.split(/\s/) : [];
  }

  async getConfig() {
    if (this.config.nrpVersion.startsWith('4.')) {
      return await this.getSimConfigV4();
    } else {
      console.error('Unsupported NRP version.');
    }
  }

  async getFiles(type = '') {
    let FOLDER, FOLDER_PREFIX;
    if (type === 'csv') {
      FOLDER = 'csv_records';
      FOLDER_PREFIX = 'csv_records_';
    } else if (type === 'profiler') {
      FOLDER = 'profiler_data';
      FOLDER_PREFIX = 'profiler_data_';
    } else {
      FOLDER = 'xx';
      FOLDER_PREFIX = 'xx';
    }

    const files = await this.listFiles(FOLDER);
    const fileFolders = files
      .filter(f => f.type === 'folder')
      .filter(f => f.name.startsWith(FOLDER_PREFIX));

    const getRunName = folder =>
      folder.name.replace(new RegExp(`^${FOLDER_PREFIX}`), '');
    const collectedFolderFiles = await Promise.all(
      fileFolders.map(folder =>
        this.listFiles(FOLDER + '/' + folder.name).then(files =>
          files.map(file => ({
            folder: getRunName(folder),
            ...file
          }))
        )
      )
    );
    const collectedFiles = _.flatMap(collectedFolderFiles).map(file => ({
      ...file,
      uuid: encodeURIComponent(file.uuid)
    }));
    return collectedFiles;
  }

  protected abstract async getFile(filename, type);

  protected abstract async listFiles(dirname?: string): Promise<File[]>;

  protected abstract async saveFile(
    filename,
    fileContent,
    contentType?
  ): Promise<any>;
}

class CloneExperimentService extends BaseExperimentService {
  constructor(
    experimentId,
    contextId,
    config,
    private storageRequestHandler: StorageRequestHandler
  ) {
    super(experimentId, contextId, config);
  }

  async getFile(filename, filetype) {
    const response = await this.storageRequestHandler.getFile(
      filename,
      this.experimentId,
      this.contextId,
      true
    );
    return response.body;
  }

  async listFiles(dirname = '') {
    return this.storageRequestHandler.listFiles(
      path.join(this.experimentId, dirname),
      this.contextId
    );
  }

  async saveFile(filename, fileContent, contentType = 'text/plain') {
    return this.storageRequestHandler.createOrUpdate(
      filename,
      fileContent,
      contentType,
      this.experimentId,
      this.contextId
    );
  }
}
class TemplateExperimentService extends BaseExperimentService {
  private experimentFolder?: string;
  private experimentDirectory?: string;

  constructor(
    experimentId,
    contextId,
    config,
    private proxyRequestHandler
  ) {
    super(experimentId, contextId, config);
  }

  async getExperimentFolder() {
    this.experimentFolder = path.dirname(
      path.join(this.config.experimentsPath, this.experimentId)
    );

    const experimentGlob = `${this.experimentFolder}/**/${this.experimentId}.json`;

    const experimentFiles = await glob(experimentGlob);

    if (!experimentFiles.length)
      throw `Could not find experiment file of pattern ${experimentGlob}`;

    this.experimentDirectory = path.dirname(experimentFiles[0]);
    return this.experimentDirectory;
  }

  async getFile(filename, filetype) {
    if (!this.experimentDirectory)
      this.experimentDirectory = await this.getExperimentFolder();

    let fullfileName;
    if (filetype === FILE_TYPE.BRAIN)
      fullfileName = path.join(this.config.modelsPath, filename);
    else fullfileName = path.join(this.experimentDirectory, filename);

    return q.denodeify(fs.readFile)(fullfileName, 'utf8');
  }

  async listFiles(dirname): Promise<File[]> {
    throw `Not implemented`;
  }

  async saveFile(filename, fileContent, contentType) {
    throw `Unexpected request to save '${fileContent}'. Template experiments cannot be modified`;
  }
}
