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

const path = require('path'),
  q = require('q'),
  X2JS = new require('x2js'),
  _ = require('lodash'),
  pd = require('pretty-data').pd,
  CustomModelsService = require('../storage/CustomModelsService.js');

//constants below are overriden in unit tests
let fs = require('fs-extra'),
  readFile = q.denodeify(fs.readFile),
  tmp = require('tmp');

const ensureArrayProp = (obj, prop) => {
  if (!obj[prop]) return false;
  if (!Array.isArray(obj[prop])) obj[prop] = [obj[prop]];
  return true;
};
class ExperimentCloner {
  constructor(storage, config) {
    this.storage = storage;
    this.config = config;

    this.downloadedFiles = [];
    this.tmpFolder = tmp.dirSync({ unsafeCleanup: true });
  }

  getBibiFullPath() {
    throw 'not implemented';
  }

  getExperimentFileFullPath() {
    throw 'not implemented';
  }

  async createUniqueExperimentId(token, userId, expPath, contextId) {
    //finds an unused name for a new experiment in the form 'templatename_0'
    let dirname = path.dirname(expPath);
    let expList = await this.storage.listExperiments(token, userId, contextId, {
      all: true
    });

    let expNames = _.keyBy(expList, 'name');
    let suffix = 0;
    while (expNames[`${dirname}_${suffix}`]) suffix += 1;
    return `${dirname}_${suffix}`;
  }

  async cloneExperiment(token, userId, expPath, contextId) {
    //clones the experiment
    let expName = await this.createUniqueExperimentId(
      token,
      userId,
      expPath,
      contextId
    );

    let { uuid: expUUID } = await this.storage.createExperiment(
      expName,
      token,
      userId,
      contextId
    );

    this.experimentFolder = path.dirname(
      path.join(this.config.experimentsPath, expPath)
    );

    let bibiConf = await this.flattenExperiment(
      expPath,
      expUUID,
      token,
      userId
    );

    await this.flattenBibiConf(bibiConf, expUUID, token, userId);

    let files = await this.readDownloadedFiles();

    await this.uploadDownloadedFiles(files, expUUID, token, userId);

    return expUUID;
  }

  uploadDownloadedFiles(files, expUUID, token, userId) {
    //uploads all the files copied locally
    return q.all(
      files.map(file =>
        this.storage.createOrUpdate(
          file.name,
          file.content,
          file.contentType,
          expUUID,
          token,
          userId
        )
      )
    );
  }

  async readDownloadedFiles() {
    //reads all files copied locally into a structure { name, content, contentType}
    let files = await q.all(this.downloadedFiles);

    files = files.map(f => {
      let mimetype = new Set(['.png', '.jpg']).has(path.extname(f))
        ? 'application/octet-stream'
        : 'text/plain';

      return {
        name: path.basename(f),
        content: fs.readFileSync(f),
        contentType: mimetype
      };
    });

    this.tmpFolder.removeCallback();

    return files;
  }

  async flattenExperiment(expPath, expUUID, token, userId) {
    //copies the experiment files into a a temporary flatten structure
    console.log('Flattening experiment');

    let fullExpPath = await this.getExperimentFileFullPath(
      expPath,
      expUUID,
      token,
      userId
    );

    let experimentConf = await readFile(fullExpPath, 'utf8').then(expContent =>
      new X2JS().xml2js(expContent)
    );

    let experiment = experimentConf.ExD;
    if (
      experiment.experimentControl &&
      experiment.experimentControl.stateMachine
    ) {
      ensureArrayProp(experiment.experimentControl, 'stateMachine');
      for (let sm of experiment.experimentControl.stateMachine) {
        this.downloadFile(sm._src);
        sm._src = path.basename(sm._src);
      }
    }

    this.downloadFile(experiment.thumbnail);
    experiment.thumbnail = path.basename(experiment.thumbnail);

    // if the model is zipped we don't need to do all this
    if (
      this.expModelsPaths === undefined ||
      this.expModelsPaths.environmentPath === undefined ||
      this.expModelsPaths.environmentPath.custom === false
    ) {
      this.downloadFile(
        experiment.environmentModel._src,
        this.config.modelsPath
      );

      experiment.environmentModel._src = path.basename(
        experiment.environmentModel._src
      );
    }
    if (ensureArrayProp(experiment, 'configuration'))
      for (let conf of experiment.configuration) this.downloadFile(conf._src);

    if (experiment.rosLaunch) this.downloadFile(experiment.rosLaunch._src);

    let expFile = path.join(
      this.tmpFolder.name,
      'experiment_configuration.exc'
    );

    let bibiConf = experimentConf.ExD.bibiConf._src;
    experiment.bibiConf._src = 'bibi_configuration.bibi';

    fs.writeFileSync(expFile, pd.xml(new X2JS().js2xml(experimentConf)));
    this.downloadedFiles.push(q.resolve(expFile));

    return bibiConf;
  }

  async flattenBibiConf(bibiConfFile, expUUID, token, userId) {
    //copies the bibi files into a a temporary flatten structure
    let bibiFullPath = await this.getBibiFullPath(
      bibiConfFile,
      expUUID,
      token,
      userId
    );
    let bibi = await readFile(bibiFullPath, 'utf8').then(bibiContent =>
      new X2JS().xml2js(bibiContent)
    );
    let bibiConf = bibi.bibi;

    if (ensureArrayProp(bibiConf, 'configuration'))
      for (let conf of bibiConf.configuration) {
        this.downloadFile(conf._src);
      }
    if (
      bibiConf.bodyModel &&
      (this.expModelsPaths === undefined ||
        this.expModelsPaths.robotPath === undefined ||
        this.expModelsPaths.robotPath.custom === false)
    ) {
      if (typeof bibiConf.bodyModel == 'string') {
        bibiConf.bodyModel = {
          __text: path.basename(bibiConf.bodyModel),
          _assetPath: path.dirname(bibiConf.bodyModel),
          _customAsset: false
        };
      }

      this.downloadFile(
        path.join(bibiConf.bodyModel._assetPath, bibiConf.bodyModel.__text),
        this.config.modelsPath
      );
    }

    if (
      bibiConf.brainModel &&
      (this.expModelsPaths === undefined ||
        this.expModelsPaths.brainPath === undefined ||
        this.expModelsPaths.brainPath.custom === false)
    ) {
      this.downloadFile(bibiConf.brainModel.file, this.config.modelsPath);
      bibiConf.brainModel.file = path.basename(bibiConf.brainModel.file);
    }

    if (ensureArrayProp(bibiConf, 'transferFunction'))
      for (let tf of bibiConf.transferFunction)
        if (tf._src) {
          this.downloadFile(tf._src);
          tf._src = path.basename(tf._src); // flattens file path in .bibi file
        }

    let bibiFile = path.join(this.tmpFolder.name, 'bibi_configuration.bibi');

    fs.writeFileSync(bibiFile, pd.xml(new X2JS().js2xml(bibi)));
    this.downloadedFiles.push(q.resolve(bibiFile));
  }

  downloadFile(srcFile, srcDir = this.experimentFolder, dstFile = srcFile) {
    //downloads a file
    let dstPath = path.join(this.tmpFolder.name, path.basename(dstFile));
    this.downloadedFiles.push(
      fs.copy(path.join(srcDir, srcFile), dstPath).then(() => dstPath)
    );
  }
}

class TemplateExperimentCloner extends ExperimentCloner {
  getBibiFullPath(bibiConfFile) {
    return path.join(this.experimentFolder, bibiConfFile);
  }

  getExperimentFileFullPath(expPath) {
    return path.join(this.config.experimentsPath, expPath);
  }
}

class NewExperimentCloner extends ExperimentCloner {
  constructor(storage, config, modelsPaths, newExperimentPath) {
    super(storage, config);
    this.expModelsPaths = modelsPaths;
    this.brainModelPath = 'brain_model';
    this.templateExc = newExperimentPath;
    this.newExpConfigurationPath = path.join(
      this.config.experimentsPath,
      this.templateExc
    );
    this.newExpBibiPath = path.join(
      path.dirname(this.newExpConfigurationPath),
      fs
        .readdirSync(path.dirname(this.newExpConfigurationPath))
        .filter(file => path.extname(file) == '.bibi')[0]
    );
  }

  async getRobotConfigPath(token, expUUID, userId) {
    let robotRelPath, robotConfigPath, robotModelConfig;
    if (!this.expModelsPaths.robotPath) return null;

    if (this.expModelsPaths.robotPath.custom) {
      robotRelPath = await this.handleZippedModel(
        token,
        expUUID,
        userId,
        'robotPath'
      );
      robotModelConfig = robotRelPath.modelConfig;
      robotRelPath = robotRelPath.name;
    } else {
      robotRelPath = _.takeRight(
        this.expModelsPaths.robotPath.path.split(path.sep),
        2
      )[0];

      robotConfigPath = path.join(
        this.config.modelsPath,
        robotRelPath,
        'model.config'
      );

      robotModelConfig = await readFile(
        robotConfigPath,
        'utf8'
      ).then(robotContent => new X2JS().xml2js(robotContent));
    }
    return {
      robotModelConfig: robotModelConfig,
      robotRelPath: robotRelPath
    };
  }

  async handleZippedModel(token, expUUID, userId, modelType) {
    let brain;
    if (modelType == 'brainPath') brain = true;
    const customModelsService = new CustomModelsService();
    const zipedModelContents = await this.storage.getCustomModel(
      { uuid: this.expModelsPaths[modelType].path },
      token,
      userId
    );
    const zipMetaData = await customModelsService
      .extractModelMetadataFromZip(zipedModelContents, brain)
      .catch(
        err =>
          this.storage.deleteExperiment(expUUID, expUUID, token, userId) &&
          q.reject(err)
      );
    await this.storage.createOrUpdate(
      zipMetaData.name,
      zipMetaData.data,
      'application/text',
      expUUID,
      token,
      userId
    );
    return zipMetaData;
  }

  async getBibiFullPath(bibiConf, expUUID, token, userId) {
    let brainFilePath;
    let bibi = await readFile(this.newExpBibiPath, 'utf8').then(bibiContent =>
      new X2JS().xml2js(bibiContent)
    );

    const robotModelConfig = await this.getRobotConfigPath(
      token,
      expUUID,
      userId
    );

    if (this.expModelsPaths.robotPath) {
      const customAsset = this.expModelsPaths.robotPath.custom,
        bodyModel = customAsset
          ? robotModelConfig.robotRelPath
          : // : path.join(
            //     robotModelConfig.robotRelPath,
            robotModelConfig.robotModelConfig.model.sdf.__text,
        //)
        assetPath = customAsset
          ? path.basename(this.expModelsPaths.robotPath.path)
          : path.dirname(this.expModelsPaths.robotPath.path);

      bibi.bibi.bodyModel = {
        __text: bodyModel,
        _customAsset: customAsset,
        _assetPath: assetPath
      };
    } else {
      delete bibi.bibi.bodyModel;
    }

    if (this.expModelsPaths.brainPath) {
      if (this.expModelsPaths.brainPath.custom) {
        brainFilePath = await this.handleZippedModel(
          token,
          expUUID,
          userId,
          'brainPath'
        );
        bibi.bibi.brainModel.file = brainFilePath.name;
        bibi.bibi.brainModel._customModelPath = path.basename(
          this.expModelsPaths.brainPath.path
        );
      } else {
        brainFilePath = path.basename(this.expModelsPaths.brainPath.path);
        bibi.bibi.brainModel.file = path.join(
          this.brainModelPath,
          brainFilePath
        );
      }
    } else delete bibi.bibi.brainModel;

    const bibiFullPath = path.join(
      this.tmpFolder.name,
      'bibi_configuration.bibi'
    );
    fs.writeFileSync(bibiFullPath, new X2JS().js2xml(bibi));
    return bibiFullPath;
  }

  async getExperimentFileFullPath(expPath, expUUID, token, userId) {
    let experimentConf = await readFile(
      this.newExpConfigurationPath,
      'utf8'
    ).then(expContent => new X2JS().xml2js(expContent));

    const envModelConfig = await this.handleEnvironmentFiles(
      experimentConf,
      expUUID,
      token,
      userId
    );

    const robotModelConfig = await this.getRobotConfigPath(
      token,
      expUUID,
      userId
    );

    // Change the name to be more meaningful
    experimentConf = this.changeExperimentName(
      experimentConf,
      robotModelConfig,
      envModelConfig,
      this.expModelsPaths.brainPath && this.expModelsPaths.brainPath.name
    );

    const expFilePath = path.join(
      this.tmpFolder.name,
      'experiment_configuration.exc'
    );
    fs.writeFileSync(expFilePath, new X2JS().js2xml(experimentConf));

    return expFilePath;
  }

  changeExperimentName(
    experimentConf,
    robotModelConfig,
    envModelConfig,
    brainName
  ) {
    let robotName;
    if (robotModelConfig) {
      if (this.expModelsPaths.robotPath.custom) {
        robotName = robotModelConfig.robotModelConfig.model.name[0];
      } else {
        robotName = robotModelConfig.robotModelConfig.model.name;
      }
    }

    experimentConf.ExD.name = `New ${robotName
      ? `${robotName} in `
      : ''} ${envModelConfig.model.name}
    ${brainName ? `with ${brainName}` : ''} experiment`;
    return experimentConf;
  }

  async handleEnvironmentFiles(experimentConf, expUUID, token, userId) {
    let envRelPath, envConfigPath;
    let envModelConfig = {};
    //handle zipped models
    if (this.expModelsPaths.environmentPath.custom) {
      envRelPath = (await this.handleZippedModel(
        token,
        expUUID,
        userId,
        'environmentPath'
      )).name;
      experimentConf.ExD.environmentModel._src = envRelPath;
      experimentConf.ExD.environmentModel._customModelPath = path.basename(
        this.expModelsPaths.environmentPath.path
      );
      envModelConfig.model = {};
      envModelConfig.model.name = path
        .basename(envRelPath, '.sdf')
        .split('_')
        .join(' ');
    } else {
      envRelPath = _.takeRight(
        this.expModelsPaths.environmentPath.path.split(path.sep),
        2
      );

      envConfigPath = path.join(
        this.config.modelsPath,
        envRelPath[0],
        envRelPath[1]
      );

      envModelConfig = await readFile(envConfigPath, 'utf8').then(envContent =>
        new X2JS().xml2js(envContent)
      );

      experimentConf.ExD.environmentModel._src = path.join(
        envRelPath[0],
        envModelConfig.model.sdf.__text
      );
    }
    return envModelConfig;
  }
}

module.exports = {
  TemplateExperimentCloner: TemplateExperimentCloner,
  NewExperimentCloner: NewExperimentCloner,
  ExperimentCloner: ExperimentCloner
};
