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

import { Storage as CollabStorage } from '../storage/Collab/Storage';
import ConfigurationManager from '../utils/configurationManager';

// mocked modules
// tslint:disable: prefer-const variable-name
let utils = require('../storage/FS/utils').default;
let StorageRequestHandler = require('../storage/requestHandler').default;

const fs = require('fs');
const q = require('q');
const path = require('path');
let readFile = q.denodeify(fs.readFile);
// tslint:enable: prefer-const variable-name

ConfigurationManager.initialize();
let storageRequestHandler;
// not a constant, because mocked on unit test
// tslint:disable-next-line: prefer-const
let glob = q.denodeify(require('glob'));

export default class TemplateExperimentsService {
  static get JSON_FILE_PATTERN() {
    return '*/*.json';
  }

  private templatesCollabPath: string = '';
  private templatesFSPath: string = '';
  private experiments: any[] | null;
  private collabStorage: CollabStorage;

  constructor(private config) {
    this.experiments = null;
    this.templatesFSPath = '';
    try {
      this.templatesCollabPath = this.config.templatesPath.Collab ? this.config.templatesPath.Collab : '';
      this.templatesFSPath = this.config.templatesPath.FS ? this.config.templatesPath.FS : '';
      console.log(
        `Using ${this.config.authentication} authentication and ${this.templatesCollabPath}, ${this.templatesFSPath} as templates paths`
      );
    } catch (e) {
      console.info('Wrong templates paths in configuration : ',e);
    }

    this.collabStorage = new CollabStorage(this.config);

    storageRequestHandler = new StorageRequestHandler(config);
  }

  async getExperiments(authToken) {
    if (this.experiments === null) {
      this.experiments = await this.loadExperiments(authToken);
    }
    return this.experiments;
  }

  async loadExperiments(authToken) {
    if (this.config.authentication === 'FS') {
      return await this.loadExperimentsLocalFilesystem();
    } else {
      const experiments: string[] = [];
      if (this.templatesFSPath !== '') {
        const localExperiments = await this.loadExperimentsLocalFilesystem();
        experiments.push(...localExperiments);
      }
      if (this.templatesCollabPath !== '') {
        const collabExperiments = await this.loadExperimentsCollab(authToken)
        experiments.push(...collabExperiments);
      }
      return experiments;
    }
  }

  async loadExperimentsLocalFilesystem() {
    let expConfigFilepath;
    expConfigFilepath = await glob(
      path.join(
        this.templatesFSPath,
        TemplateExperimentsService.JSON_FILE_PATTERN
      )
    );

    return glob(
      path.join(
        this.templatesFSPath,
        TemplateExperimentsService.JSON_FILE_PATTERN
      )
    ).then(experimentConfigFiles =>
      q.all(
        experimentConfigFiles.map(expConfigFile =>
          this.buildExperiment(expConfigFile)
        )
      )
    );
  }

  async loadExperimentsCollab(authToken) {
    const templatesPathSplit = this.templatesCollabPath
      .split('/')
      .filter(element => element !== '');
    const templateCollabName =
      templatesPathSplit[templatesPathSplit.length - 1];
    const collabConfig = await this.collabStorage.getBucketNrpExperimentsConfig(
      templateCollabName,
      authToken
    );
    let configFiles: any[] = [];
    for (const experiment of collabConfig.experiments) {
      const experimentConfigFiles = await this.collabStorage.getExperimentConfigFiles(
        templateCollabName,
        experiment.path,
        authToken
      );
      configFiles.push(...experimentConfigFiles);
    }
    configFiles = await q.all(
      configFiles.map(expConfigFile =>
        this.buildExperiment(
          expConfigFile.uuid,
          undefined,
          true,
          true,
          authToken
        )
      )
    );
    return configFiles;
  }

  loadSharedExperiments(req) {
    return q.all(
      storageRequestHandler.listExperimentsSharedByUsers(req).then(exps =>
        exps.map(exp => {
          let expConfigFilepath;
          expConfigFilepath = path.join(
            utils.storagePath,
            exp.name + '*/*.json'
          );

          return glob(expConfigFilepath).then(pathFile =>
            this.buildExperiment(pathFile[0], exp.name, true)
          );
        })
      )
    );
  }

  getSharedExperimentFilePath(experimentPath, experimentFile) {
    return path.join(utils.storagePath, experimentPath, experimentFile);
  }

  getExperimentFilePath(experimentPath, experimentFile) {
    return path.join(this.templatesFSPath, experimentPath, experimentFile);
  }

  getJsonProperty(prop, defaultValue?: string | undefined | number) {
    const exists: boolean = Boolean(prop);
    const isNamespaced: boolean = exists && Boolean(prop.__text);
    if (isNamespaced) prop = prop.__text;
    return exists ? prop : defaultValue ? defaultValue : undefined;
  }

  async buildExperiment(
    fileName,
    expName = '',
    isExperimentShared = false,
    isCollab = false,
    authToken?
  ) {
    let experimentContent;

    try {
      experimentContent = isCollab
        ? (await this.collabStorage.getFile(fileName, undefined, authToken, undefined))
        .body
        : await readFile(fileName, 'utf8');

      const experimentConfig = JSON.parse(experimentContent);

      const fileConfigPath = isCollab
        ? fileName
        : isExperimentShared
        ? path.relative(utils.storagePath, fileName)
        : path.relative(this.templatesFSPath, fileName);
      const expPath = path.dirname(fileConfigPath);
      const suffix = authToken ? '[Collab]' : '[FS]';

      return {
        path: expPath,
        configFile: path.basename(fileConfigPath),
        experimentId: fileConfigPath,
        thumbnail: '/',
        SimulationName: this.getJsonProperty(experimentConfig.SimulationName),
        SimulationDescription: this.getJsonProperty(
          experimentConfig.SimulationDescription,
          'No description available for this experiment.'
        ),
        SimulationTimeout: this.getJsonProperty(
          experimentConfig.SimulationTimeout,
          0
        ),
        DataPackProcessor: this.getJsonProperty(
          experimentConfig.DataPackProcessor,
          'tf'
        ),
        SimulationLoop: this.getJsonProperty(
          experimentConfig.SimulationLoop,
          'FTILoop'
        ),
        ComputationalGraph: this.getJsonProperty(
          experimentConfig.ComputationalGraph
        ),
        ConnectMQTT: this.getJsonProperty(experimentConfig.ConnectMQTT),
        SimulationTimestep: this.getJsonProperty(
          experimentConfig.SimulationTimestep,
          0.01
        ),
        ProcessLauncherType: this.getJsonProperty(
          experimentConfig.ProcessLauncherType,
          'Basic'
        ),
        EngineConfigs: this.getJsonProperty(experimentConfig.EngineConfigs),
        ExternalProcesses: this.getJsonProperty(
          experimentConfig.ExternalProcesses
        ),
        DataPackProcessingFunctions: this.getJsonProperty(
          experimentConfig.DataPackProcessingFunctions
        ),
        EventLoopTimeout: this.getJsonProperty(
          experimentConfig.EventLoopTimeout
        ),
        EventLoopTimestep: this.getJsonProperty(
          experimentConfig.EventLoopTimestep
        ),
        ConnectROS: this.getJsonProperty(experimentConfig.ConnectROS)
      };
    } catch (err) {
      console.error(err);

      return;
    }
  }
}
