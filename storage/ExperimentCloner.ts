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
import utils from './FS/utils';
import ModelsService from './ModelsService';

const path = require('path'),
  q = require('q'),
  _ = require('lodash'),
  pd = require('pretty-data').pd,
  exec = require('child_process').exec,
  walk = require('walk');

// constants below are overriden in unit tests
// tslint:disable: prefer-const
let fs = require('fs-extra'),
  readFile = q.denodeify(fs.readFile),
  tmp = require('tmp');
// tslint:enable: prefer-const

const ensureArrayProp = (obj, prop) => {
  if (!obj[prop]) return false;
  if (!Array.isArray(obj[prop])) obj[prop] = [obj[prop]];
  return true;
};

abstract class ExperimentCloner {
  protected tmpFolder = tmp.dirSync({ unsafeCleanup: true });
  protected experimentFolder?;
  private downloadedFiles: Array<Promise<string>> = [];

  constructor(protected storage, protected config) { }

  abstract getBibiFullPath(bibiConfFile, expUUID, token, userId);

  abstract getExperimentFileFullPath(
    expPath,
    expUUID,
    token,
    userId,
    defaultName
  );

  async createUniqueExperimentId(token, userId, expPath, contextId) {
    // finds an unused name for a new experiment in the form 'templatename_0'
    const dirname = path.dirname(expPath);
    return this.storage.createUniqueExperimentId(token, userId, dirname, contextId);
  }

  async cloneExperiment(token, userId, expPath, contextId, defaultName, defaultMode) {
    // clones the experiment

    let expName;

    expName = await this.createUniqueExperimentId(
      token,
      userId,
      expPath,
      contextId
    );

    const { uuid: expUUID } = await this.storage.createExperiment(
      expName,
      token,
      userId,
      contextId
    );
    try {
      this.experimentFolder = path.dirname(
        path.join(this.config.experimentsPath, expPath)
      );

      const bibiConf = await this.flattenExperiment(
        expPath,
        expUUID,
        token,
        userId,
        defaultName
      );

      await this.flattenBibiConf(expPath, bibiConf, expUUID, token, userId, defaultMode);

      const files = await this.readDownloadedFiles();

      await this.uploadDownloadedFiles(files, expUUID, token, userId);

      await this.copyResourcesFolder(
        this.experimentFolder,
        expName,
        expUUID,
        token,
        userId
      );

      await this.copyAssetsFolder(
        this.experimentFolder,
        expName,
        expUUID,
        token,
        userId
      );

      return expUUID;
    } catch (e) {
      this.storage.deleteExperiment(expName, expName, token, userId);
      throw e;
    }
  }

  async copyResourcesFolder(experimentFolder, expName, expUUID, token, userId) {
    const resExpPath = path.join(this.experimentFolder, 'resources');
    const resPath = path.join(expUUID, 'resources');
    if (fs.existsSync(path.join(experimentFolder, 'resources'))) {
      const files = await this.downloadResourcesfiles(resExpPath);
      await this.storage.createFolder('resources', expName, token, userId);
      await this.uploadDownloadedFiles(files, resPath, token, userId);
    } else {
      await this.storage.createFolder('resources', expName, token, userId);
    }
    if (!fs.existsSync(path.join(experimentFolder, 'resources', 'textures'))) {
      await this.storage.createFolder(
        path.join('resources', 'textures'),
        expName,
        token,
        userId
      );
    }
  }

  async downloadResourcesfiles(resExpPath) {
    const files = [] as any[];
    const options = {
      listeners: {
        file(root, fileStats, next) {
          const name = root.substring(
            root.indexOf('resources') + 10,
            root.length
          );
          files.push({
            name: name + '/' + fileStats.name,
            contentType: 'text/plain',
            content: fs.readFileSync(root + '/' + fileStats.name)
          });
          next();
        },
        errors(root, nodeStatsArray, next) {
          next();
        }
      }
    };
    walk.walkSync(resExpPath, options);
    return files;
  }

  async copyAssetsFolder(experimentFolder, expName, expUUID, token, userId) {
    const assetsExpPath = path.join(this.experimentFolder, 'assets');
    const assetsPath = path.join(expUUID, 'assets');
    if (fs.existsSync(path.join(experimentFolder, 'assets'))) {
      const files = await this.downloadAssetsfiles(assetsExpPath);
      await this.storage.createFolder('assets', expName, token, userId);
      await this.uploadDownloadedFiles(files, assetsPath, token, userId);
    } else {
      await this.storage.createFolder('assets', expName, token, userId);
    }
  }

  async downloadAssetsfiles(assetsExpPath) {
    const files = [] as any[];
    const options = {
      listeners: {
        file(root, fileStats, next) {
          const name = root.substring(
            root.indexOf('assets') + 7,
            root.length
          );
          files.push({
            name: name + '/' + fileStats.name,
            content: fs.readFileSync(root + '/' + fileStats.name)
          });
          next();
        },
        errors(root, nodeStatsArray, next) {
          next();
        }
      }
    };
    walk.walkSync(assetsExpPath, options);
    return files;
  }

  uploadDownloadedFiles(files, expUUID, token, userId) {
    // uploads all the files copied locally
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
    // reads all files copied locally into a structure { name, content, contentType}
    let files = await q.all(this.downloadedFiles);

    files = files.map(f => {
      const mimetype = new Set(['.png', '.jpg']).has(path.extname(f))
        ? 'application/octet-stream'
        : 'text/plain';

      const pathRelativeToTemp = f.substring(this.tmpFolder.name.length + 1); // remove tmpFolder path (plus a slash) from f

      return {
        name: pathRelativeToTemp,
        content: fs.readFileSync(f),
        contentType: mimetype
      };
    });

    this.tmpFolder.removeCallback();

    return files;
  }

  async flattenExperiment(expPath, expUUID, token, userId, defaultName) {
    // copies the experiment files into a a temporary flatten structure
    console.log('Flattening experiment');

    const fullExpPath = await this.getExperimentFileFullPath(
      expPath,
      expUUID,
      token,
      userId,
      defaultName
    );

    const experimentConf = await readFile(fullExpPath, 'utf8').then(expContent =>
      new X2JS().xml2js(expContent)
    );

    const experiment = experimentConf.ExD;
    if (
      experiment.experimentControl &&
      experiment.experimentControl.stateMachine
    ) {
      ensureArrayProp(experiment.experimentControl, 'stateMachine');
      for (const sm of experiment.experimentControl.stateMachine) {
        this.downloadFile(sm._src);
      }
    }

    this.downloadFile(experiment.thumbnail);

    let dstFile = experiment.environmentModel._src;
    let srcDir = this.experimentFolder;
    if (experiment.environmentModel._model) {
      dstFile = path.join(
        experiment.environmentModel._model,
        experiment.environmentModel._src
      );
      srcDir = await this.storage.getModelFullPath(
        'environments',
        experiment.environmentModel._model
        );
    }
    this.downloadFile(
      experiment.environmentModel._src,
      srcDir,
      dstFile
      );

    const launchFiles = fs.readdirSync(srcDir).filter(f => {
      return path.extname(f).toLowerCase() === '.launch';
    });

    for (const launchFile of launchFiles) {
      const model = experiment.environmentModel._model || '';
      this.downloadFile(
        launchFile,
        srcDir,
        path.join(model, launchFile)
      );
    }

    if (ensureArrayProp(experiment, 'configuration'))
      for (const conf of experiment.configuration) this.downloadFile(conf._src);

    if (experiment.rosLaunch) this.downloadFile(experiment.rosLaunch._src);

    experiment.cloneDate = utils.getCurrentTimeAndDate();

    const expFile = path.join(
      this.tmpFolder.name,
      'experiment_configuration.exc'
    );

    const bibiConf = experimentConf.ExD.bibiConf._src;
    experiment.bibiConf._src = 'bibi_configuration.bibi';

    const xmlFile = pd.xml(new X2JS({ escapeMode: false }).js2xml(experimentConf)); // In particular, we don't escape quotes in ExD.description
    fs.writeFileSync(expFile, xmlFile);
    this.downloadedFiles.push(q.resolve(expFile));

    return bibiConf;
  }

  async copyH5File(pythonModuleName) {
    // in case we have an h5 file we have to copy it over as well
    const pathToPythonScript = path.join(__dirname, 'h5FileExtractor.py');
    try {
      const h5FileName = (await q.denodeify(exec)(
        `python ${pathToPythonScript} ${pythonModuleName}`
      ))[1];
      const brainModelPath = path.join(this.config.modelsPath, 'brain_model');
      if (h5FileName) this.downloadFile(h5FileName, brainModelPath);
    } catch (err) {
      console.log('No h5 file to copy');
    }
  }

  async flattenBibiConf(expPath, bibiConfFile, expUUID, token, userId, defaultMode) {
    // copies the bibi files into a a temporary flatten structure
    const bibiFullPath = await this.getBibiFullPath(
      bibiConfFile,
      expUUID,
      token,
      userId
    );
    const bibi = await readFile(bibiFullPath, 'utf8').then(bibiContent =>
      new X2JS().xml2js(bibiContent)
    );
    const bibiConf = bibi.bibi;

    if (ensureArrayProp(bibiConf, 'configuration')) {
      for (const conf of bibiConf.configuration) {
        this.downloadFile(conf._src);
      }
    }

    if (bibiConf.bodyModel) {
      if (!Array.isArray(bibiConf.bodyModel))
        bibiConf.bodyModel = [bibiConf.bodyModel];

      for (let model of bibiConf.bodyModel) {
        if (model) {
          const bodyModelFile = model.__text || model;
          model = {
            __text: bodyModelFile,
            _robotId: model._robotId ? model._robotId : 'robot',
            __prefix: bibiConf.__prefix,
            _model: model._model
          };
          const robotid = model._robotId ? model._robotId : 'robot';
          const dstFile = path.join(robotid, bodyModelFile);
          let srcDir = path.join(this.experimentFolder, model._robotId);
          if (model._model) {
            srcDir = await this.storage.getModelFullPath('robots', model._model);
          }
          this.downloadFile(model.__text, srcDir, dstFile);

          // find and upload roslaunch file into experiments directory
          const sdfFolder = path.dirname(
            path.join(this.config.modelsPath, model.__text)
          );
          const launchFile = fs.readdirSync(sdfFolder).filter(f => {
            return path.extname(f).toLowerCase() === '.launch';
          });
          if (launchFile.length) {
            this.downloadFile(
              launchFile[0],
              sdfFolder,
              path.join(robotid, launchFile[0])
            );
          }
        }
      }
    }

    if (bibiConf.brainModel) {
      const brainFile =
        bibiConf.brainModel.file.__text || bibiConf.brainModel.file;

      let srcDir = path.join(this.experimentFolder, path.dirname(brainFile));
      let dstFile = brainFile;
      if (bibiConf.brainModel._model) {
        srcDir = await this.storage.getModelFullPath('brains', bibiConf.brainModel._model);
        dstFile = path.join(bibiConf.brainModel._model, brainFile);
      }
      this.downloadFile(brainFile, srcDir, dstFile);

      bibiConf.brainModel.file = {
        __text: brainFile,
        __prefix: bibiConf.__prefix
      };

      await this.copyH5File(brainFile);
    }

    if (defaultMode) bibiConf.mode = {__text: defaultMode, __prefix: bibiConf.__prefix};

    if (ensureArrayProp(bibiConf, 'transferFunction'))
      for (const tf of bibiConf.transferFunction)
        if (tf._src) {
          this.downloadFile(tf._src);
        }

    const bibiFile = path.join(this.tmpFolder.name, 'bibi_configuration.bibi');

    fs.writeFileSync(bibiFile, pd.xml(new X2JS().js2xml(bibi)));
    this.downloadedFiles.push(q.resolve(bibiFile));
  }

  downloadFile(srcFile, srcDir = this.experimentFolder, dstFile = srcFile) {
    const dstPath = path.join(this.tmpFolder.name, dstFile);

    this.downloadedFiles.push(
      fs
        .ensureDir(path.dirname(dstPath))
        .then(() =>
          fs.copy(path.join(srcDir, srcFile), dstPath).then(() => dstPath)
        )
    );
  }
}

export class TemplateExperimentCloner extends ExperimentCloner {
  getBibiFullPath(bibiConfFile) {
    return path.join(this.experimentFolder, bibiConfFile);
  }

  getExperimentFileFullPath(expPath) {
    return path.join(this.config.experimentsPath, expPath);
  }
}

export class NewExperimentCloner extends ExperimentCloner {
  private newExpConfigurationPath;
  private newExpBibiPath;

  // environmentpath is not a path
  constructor(storage, config, protected environmentPath, private templateExc) {
    super(storage, config);

    this.newExpConfigurationPath = path.join(
      this.config.experimentsPath,
      this.templateExc
    );
    this.newExpBibiPath = path.join(
      path.dirname(this.newExpConfigurationPath),
      fs
        .readdirSync(path.dirname(this.newExpConfigurationPath))
        .filter(file => path.extname(file) === '.bibi')[0]
    );
  }

  async getBibiFullPath() {
    const bibi = await readFile(this.newExpBibiPath, 'utf8').then(bibiContent =>
      new X2JS().xml2js(bibiContent)
    );

    const bibiFullPath = path.join(
      this.tmpFolder.name,
      'bibi_configuration.bibi'
    );
    fs.writeFileSync(bibiFullPath, new X2JS().js2xml(bibi));
    return bibiFullPath;
  }

  async getExperimentFileFullPath(
    expPath,
    expUUID,
    token,
    userId,
    defaultName
  ) {
    const experimentConf = await readFile(
      this.newExpConfigurationPath,
      'utf8'
    ).then(expContent => new X2JS().xml2js(expContent));

    if (defaultName) experimentConf.ExD.name = defaultName;
    else {
      experimentConf.ExD.name = 'New experiment';
    }
    const expFilePath = path.join(
      this.tmpFolder.name,
      'experiment_configuration.exc'
    );
    fs.writeFileSync(expFilePath, new X2JS().js2xml(experimentConf));

    return expFilePath;
  }
}
