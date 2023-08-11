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

import utils from './FS/utils';
import * as storageConsts from './StorageConsts';

const path = require('path');
const q = require('q');
const _ = require('lodash');
const walk = require('walk');

const glob = q.denodeify(require('glob'));

// constants below are overriden in unit tests
// tslint:disable: prefer-const
let fs = require('fs-extra');
let readFile = q.denodeify(fs.readFile);
let tmp = require('tmp');
// tslint:enable: prefer-const

// const ensureArrayProp = (obj, prop) => {
//   if (!obj[prop]) return false;
//   if (!Array.isArray(obj[prop])) obj[prop] = [obj[prop]];
//   return true;
// };

abstract class ExperimentCloner {
  protected tmpFolder = tmp.dirSync({ unsafeCleanup: true });
  protected templateFolder?;
  private downloadedFiles: Promise<string>[] = [];

  constructor(protected storage, protected config) {}

  abstract getExperimentFileFullPath(expPath, token, userId, defaultName);

  async createUniqueExperimentId(token, userId, templateConfPath, contextId) {
    // finds an unused name for a new experiment in the form 'templatename_0'
    const dirname = path.dirname(templateConfPath);
    return this.storage.createUniqueExperimentId(
      token,
      userId,
      dirname,
      contextId
    );
  }

  /**
   * Clones the experiment from the template
   * @param token access token
   * @param userId user ID
   * @param {string} templateConfPath the path to the template JSON configuration file
   * @param contextId context ID
   * @returns {Array} the list of files
   */
  async cloneExperiment(
    token,
    userId,
    templateConfPath,
    contextId,
    defaultName,
    defaultMode
  ) {
    const expPath = await this.createUniqueExperimentId(
      token,
      userId,
      templateConfPath,
      contextId
    );
    // expUUID == expPath (dir name) in local storage
    const { uuid: expUUID } = await this.storage.createExperiment(
      expPath,
      token,
      userId,
      contextId
    );

    try {
      this.templateFolder = path.dirname(
        path.join(this.config.templatesPath, templateConfPath)
      );

      // const proxyConfig = ConfigurationManager.loadConfigFile();
      const newConfig = await this.flattenExperiment(
        templateConfPath,
        expPath,
        token,
        userId,
        defaultName
      );

      const files = await this.readDownloadedFiles();
      await this.uploadDownloadedFiles(files, expPath, token, userId);
      await this.copyResourcesFolder(expPath, token, userId);
      await this.copyAssetsFolder(expPath, token, userId);

      // write updated config
      this.storage.createOrUpdate(
        storageConsts.defaultConfigName,
        JSON.stringify(newConfig, null, 4),
        'application/json',
        expPath,
        token,
        userId
      );

      return expPath;
    } catch (e) {
      this.storage.deleteExperiment(expPath, expPath, token, userId);
      throw e;
    }
  }

  /**
   * Copies the `resources` folder from the template/experiment to the new experiment folder
   * @param {string} expPath the destination experiment directory name (coincides with the experiment ID)
   * @param {string} token access roken
   * @param {string} userId user ID
   */
  async copyResourcesFolder(expPath: string, token: string, userId: string) {
    const srcResourcesPath = path.join(this.templateFolder, 'resources');
    const dstResourcesPath = path.join(expPath, 'resources');
    if (fs.existsSync(path.join(this.templateFolder, 'resources'))) {
      const files = await this.downloadResourcesfiles(srcResourcesPath);
      await this.storage.createFolder('resources', expPath, token, userId);
      await this.uploadDownloadedFiles(files, dstResourcesPath, token, userId);
    }
    // NRP 4 do not have dafault resources folder
    // else {
    //   await this.storage.createFolder('resources', expPath, token, userId);
    // }
    // if (
    //   !fs.existsSync(path.join(this.templateFolder, 'resources', 'textures'))
    // ) {
    //   await this.storage.createFolder(
    //     path.join('resources', 'textures'),
    //     expPath,
    //     token,
    //     userId
    //   );
    // }
  }

  /**
   * Generates the list of the `resources` folder files
   * @param {string} resourcesPath the path to the `resources` folder
   * @returns {Array} the list of files
   */
  async downloadResourcesfiles(resourcesPath: string) {
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
    walk.walkSync(resourcesPath, options);
    return files;
  }

  /**
   * Copies the `assets` folder from the template/experiment to the new experiment folder
   * @param {string} expPath the destination experiment directory name (coincides with the experiment ID)
   * @param {string} token access roken
   * @param {string} userId user ID
   */
  async copyAssetsFolder(expPath, token, userId) {
    const srcAssetsPath = path.join(this.templateFolder, 'assets');
    const dstAssetsPath = path.join(expPath, 'assets');
    if (fs.existsSync(path.join(this.templateFolder, 'assets'))) {
      const files = await this.downloadAssetsfiles(srcAssetsPath);
      await this.storage.createFolder('assets', expPath, token, userId);
      await this.uploadDownloadedFiles(files, dstAssetsPath, token, userId);
    }
    // NRP 4 do not have dafault assets folder
    // else {
    //   await this.storage.createFolder('assets', expPath, token, userId);
    // }
  }

  /**
   * Generates the list of the `assets` folder files
   * @param {string} assetsPath the path to the `assets` folder
   * @returns {Array} the list of files
   */
  async downloadAssetsfiles(assetsPath) {
    const files = [] as any[];
    const options = {
      listeners: {
        file(root, fileStats, next) {
          const name = root.substring(root.indexOf('assets') + 7, root.length);
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
    walk.walkSync(assetsPath, options);
    return files;
  }

  uploadDownloadedFiles(files, expPath, token, userId) {
    // uploads all the files copied locally
    return q.all(
      files.map(file =>
        this.storage.createOrUpdate(
          file.name,
          file.content,
          file.contentType,
          expPath,
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

  async flattenExperiment(configPath, expPath, token, userId, defaultName) {
    // copies the experiment files into a a temporary flatten structure

    const fullExpPath = await this.getExperimentFileFullPath(
      configPath,
      token,
      userId,
      defaultName
    );
    // TODO: detect source config more accurately
    this.downloadFile(
      configPath.split('/')[1],
      this.templateFolder,
      storageConsts.defaultConfigName
    );

    // The parsed experiment JSON configuration
    const experiment = await readFile(fullExpPath, 'utf8').then(expContent =>
      JSON.parse(expContent)
    );

    experiment.cloneDate = utils.getCurrentTimeAndDate();
    experiment.SimulationName =
      utils.getCurrentTimeAndDate() + ' ' + experiment.SimulationName;

    // TODO: [NRRPLT-8771] Provide sofisticated cloning with specifying the dependencies in the configuration JSON
    // Currently, the whole directory is cloned
    const experimentGlob = `${this.templateFolder}/**/*.!(json)`;
    const experimentFiles = await glob(experimentGlob);
    for (const f of experimentFiles) {
      try {
        this.downloadFile(path.relative(this.templateFolder, f));
      } catch (err) {
        console.error('Could not clone file ' + f.toString());
      }
    }

    // // TODO clean this
    // //  if (await fs.exists(experiment.thumbnail)) {
    // //    try {
    // //      this.downloadFile(experiment.thumbnail);
    // //    } catch (err) {
    // //      console.log('No picture available.');
    // //    }
    // //  }

    // if (ensureArrayProp(experiment, 'configuration'))
    //   for (const conf of experiment.configuration) this.downloadFile(conf._src);

    // if (experiment.rosLaunch) this.downloadFile(experiment.rosLaunch._src);

    // // Download main_script.py
    // // TODO: detect the name of the script carefully
    // this.downloadFile('main_script.py', this.templateFolder,
    //   'main_script.py'
    // );

    // this.readProcessLaunchers(configPath, experiment);

    // this.readEngines(configPath, experiment);

    // this.readComputationalGraph(configPath, experiment);

    // this.readTransceiverFunctions(configPath, experiment);

    return experiment;
  }

  async downloadFile(srcFile, srcDir = this.templateFolder, dstFile = srcFile) {
    const dstPath = path.join(this.tmpFolder.name.toString(), dstFile);

    this.downloadedFiles.push(
      fs
        .ensureDir(path.dirname(dstPath))
        .then(() =>
          fs.copy(path.join(srcDir, srcFile), dstPath).then(() => dstPath)
        )
    );
  }

  // async readTransceiverFunctions(expPath, experimentConf) {
  //   const DataPackProcessingFunctions =
  //     experimentConf.DataPackProcessingFunctions;
  //   // "required" : ["Name", "FileName"]
  //   if (DataPackProcessingFunctions !== undefined) {
  //     for (const tf of DataPackProcessingFunctions) {
  //       try {
  //         this.downloadFile(tf.FileName);
  //       } catch (err) {
  //         console.error('no specified transceiver function');
  //       }
  //     }
  //   }
  // }

  // async readComputationalGraph(expPath, experimentConf) {
  //   const graphes = experimentConf.ComputationalGraph;
  //   if (graphes !== undefined) {
  //     for (const cg of graphes) {
  //       try {
  //         this.downloadFile(cg);
  //       } catch (err) {
  //         console.error(' computational graph could not be downloaded : ', cg);
  //       }
  //     }
  //   }
  // }

  // async readProcessLaunchers(expPath, experimentConf) {
  //   const processes = experimentConf.ExternalProcesses;
  //   if (processes !== undefined) {
  //     for (const process of processes) {
  //       try {
  //         const cmd = process.ProcCmd.split(' ');
  //         for (const i in cmd) {
  //           const word = cmd[i];
  //           if (word.includes('.launch')) {
  //             this.downloadFile(word); // dl .launch files
  //           }
  //         }
  //       } catch (err) {
  //         console.error(
  //           ' No process launch command for process launcher : ',
  //           process.title
  //         );
  //       }
  //     }
  //   }
  // }

  // async readEngines(expPath, experimentConf) {
  //   const engines = experimentConf.EngineConfigs;
  //   const files = Array();
  //   if (engines !== undefined) {
  //     for (const engine of engines) {
  //       try {
  //         const engineType = engine.EngineType.split('_');
  //         const type = engineType[0];
  //         switch (type) {
  //           case 'opensim':
  //             break;
  //           case 'nest':
  //             const nestPath = engine.NestInitFileName;
  //             files.push(nestPath);
  //             break;
  //           case 'gazebo':
  //             const wordPath = engine.GazeboWorldFile;
  //             files.push(wordPath);
  //             break;
  //           case 'python':
  //             const pythonfilePath = engine.PythonFileName;
  //             files.push(pythonfilePath);
  //             if (engineType[1] === 'sim') {
  //               // to correct
  //               const wordPath = engine.WorldFileName;
  //               files.push(wordPath);
  //             }
  //             break;
  //           case 'datatransfer':
  //             break;
  //         }
  //       } catch (err) {
  //         console.error('Incorrect engine(s) definition :', engine.EngineName);
  //       }
  //     }
  //     for (const i in files) {
  //       this.downloadFile(files[i]);
  //     }
  //   }
  // }
}

export class TemplateExperimentCloner extends ExperimentCloner {
  getExperimentFileFullPath(expPath) {
    return path.join(this.config.templatesPath, expPath);
  }
}

// TODO: adopt for 4.0 version
export class NewExperimentCloner extends ExperimentCloner {
  private newExpConfigurationPath;
  private newExpBibiPath;

  // environmentpath is not a path
  constructor(storage, config, protected environmentPath, private templateExc) {
    super(storage, config);

    // this.newExpConfigurationPath = path.join(
    //   this.config.templatesPath,
    //   this.templateExc
    // );
    // this.newExpBibiPath = path.join(
    //   path.dirname(this.newExpConfigurationPath),
    //   fs
    //     .readdirSync(path.dirname(this.newExpConfigurationPath))
    //     .filter(file => path.extname(file) === '.bibi')[0]
    // );
  }

  async getExperimentFileFullPath(expPath, token, userId, defaultName) {
    // const experimentConf = await readFile(
    //   this.newExpConfigurationPath,
    //   'utf8'
    // ).then(expContent => new X2JS().xml2js(expContent));
    // if (defaultName) experimentConf.ExD.name = defaultName;
    // else {
    //   experimentConf.ExD.name = 'New experiment';
    // }
    // const expFilePath = path.join(
    //   this.tmpFolder.name,
    //   'experiment_configuration.exc'
    // );
    // fs.writeFileSync(expFilePath, new X2JS().js2xml(experimentConf));
    // return expFilePath;
  }
}
