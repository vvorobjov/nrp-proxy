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

import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import { pd } from 'pretty-data';
import q from 'q';
import X2JS from 'x2js';
import { File } from '../storage/BaseStorage';
import StorageRequestHandler from '../storage/requestHandler';

const glob = q.denodeify(require('glob')),
  xmlFormat = xml => pd.xml(xml);

export default class ExperimentServiceFactory {
  constructor(
    private storageRequestHandler,
    private config,
    private proxyRequestHandler
  ) { }

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
        this.storageRequestHandler
      );
    }
  }
}
const FILE_TYPE = {
  EXC: 'EXC',
  BIBI: 'BIBI',
  BRAIN: 'BRAIN',
  SM: 'SM',
  TF: 'TF'
};

abstract class BaseExperimentService {
  constructor(protected experimentId, protected contextId) { }

  async getExc() {
    const excFilename = await this.getExcFileName();
    const exc = await this.getFile(excFilename, FILE_TYPE.EXC);
    const excstr = exc.toString();
    return [new X2JS().xml2js(excstr), excFilename, excstr];
  }

  async getBibi() {
    const exc = (await this.getExc())[0].ExD;
    const bibi = await this.getFile(exc.bibiConf._src, FILE_TYPE.BIBI);
    return [new X2JS().xml2js(bibi.toString()), exc.bibiConf._src];
  }

  getTags(strTags) {
    return strTags ? strTags.split(/\s/) : [];
  }

  async getConfig() {
    /* tslint:disable */
    let ExD, file, exc;
    /* tslint:enable */
    try {
      [{ ExD }, file, exc] = await this.getExc();
    } catch (err) {
      return {}; // empty configuration object, to be interpreted by the caller as a missing exc file
    }

    let bibiConfSrc;
    try {
      const bibi = await this.getBibi();
      bibiConfSrc = bibi[1];
    } catch (err) {
      bibiConfSrc = undefined; // to be interpreted by the caller as a missing bibi file
    }

    const getExDProp = prop => (prop && prop.__prefix ? prop.__text : prop);
    const maturity = getExDProp(ExD.maturity);
    const config = {
      timeout: Number(getExDProp(ExD.timeout)) || 600,
      timeoutType:
        ExD.timeout && ExD.timeout._time === 'simulation'
          ? 'simulation'
          : 'real',
      name: getExDProp(ExD.name),
      tags: this.getTags(getExDProp(ExD.tags)),
      thumbnail: getExDProp(ExD.thumbnail),
      description: getExDProp(ExD.description),
      maturity: maturity === 'production' ? maturity : 'development',
      cloneDate: getExDProp(ExD.cloneDate) ? getExDProp(ExD.cloneDate).replace(/T/, ' ') : undefined,
      cameraPose:
        ExD.cameraPose &&
        [
          'cameraPosition._x',
          'cameraPosition._y',
          'cameraPosition._z',
          'cameraLookAt._x',
          'cameraLookAt._y',
          'cameraLookAt._z'
        ].map(prop => Number(_.get(ExD.cameraPose, prop))),
      brainProcesses:
        ExD.bibiConf && ExD.bibiConf._processes
          ? Number(ExD.bibiConf._processes)
          : undefined,
      physicsEngine: ExD.physicsEngine,
      experimentFile: exc,
      bibiConfSrc,
      visualModel: null,
      visualModelParams: [] as number[]
    };

    if (ExD.visualModel) {
      const pose = ExD.visualModel.visualPose,
        roll = Number(pose._roll || pose._ux),
        pitch = Number(pose._pitch || pose._uy),
        yaw = Number(pose._yaw || pose._uz),
        scale = Number(ExD.visualModel._scale || 1.0);

      config.visualModel = ExD.visualModel._src;

      config.visualModelParams = [
        ...['_x', '_y', '_z'].map(prop => Number(_.get(pose, prop))),
        roll,
        pitch,
        yaw,
        scale
      ];
    }

    return config;
  }

  async getStateMachines() {
    const exc = (await this.getExc())[0].ExD;

    const smDict = {};
    const filePromises: any[] = [];
    if (exc.experimentControl) {
      let stateMachines = exc.experimentControl.stateMachine;
      if (!Array.isArray(exc.experimentControl.stateMachine))
        stateMachines = [stateMachines];

      for (const sm of stateMachines) {
        filePromises.push(
          this.getFile(sm._src, FILE_TYPE.SM).then(
            smFile => (smDict[sm._id] = smFile.toString())
          )
        );
      }
    }
    return Promise.all(filePromises).then(() => ({
      data: smDict
    }));
  }

  async setStateMachines(stateMachines) {
    const [excFile, excFileName] = await this.getExc();
    const exc = excFile.ExD;
    if (!exc['_xmlns:xsi']) {
      exc['_xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
    }

    const promises: Array<Promise<any>> = [];
    if (!_.isEmpty(stateMachines))
      exc.experimentControl = {
        __prefix: exc.__prefix,
        stateMachine: _.map(stateMachines, (sm, id) => ({
          __prefix: exc.__prefix,
          _id: id,
          _src: `${id}.exd`,
          '_xsi:type':
            (exc.__prefix ? `${exc.__prefix}:` : '') + 'SMACHStateMachine'
        }))
      };
    else delete exc.experimentControl;

    return Promise.all([
      ..._.map(stateMachines, (sm, id) =>
        promises.push(this.saveFile(`${id}.exd`, sm))
      ),
      this.saveFile(excFileName, xmlFormat(new X2JS().js2xml(excFile)))
    ]).then(() => ({}));
  }

  async getBrain() {
    const bibi = (await this.getBibi())[0].bibi;
    if (!bibi.brainModel) return null;
    let brainModelFile = bibi.brainModel.file.toString();
    if (bibi.brainModel._model) {
      brainModelFile = path.join(bibi.brainModel._model, brainModelFile);
    }
    const brain = (await this.getFile(
      brainModelFile.toString(),
      FILE_TYPE.BRAIN
    )).toString();

    if (!bibi.brainModel.populations) bibi.brainModel.populations = [];
    else if (!Array.isArray(bibi.brainModel.populations))
      bibi.brainModel.populations = [bibi.brainModel.populations];

    const robots: string[] = [];
    if (!bibi.bodyModel) bibi.bodyModel = [];
    else if (!Array.isArray(bibi.bodyModel)) bibi.bodyModel = [bibi.bodyModel];

    if (bibi.bodyModel.length && !bibi.bodyModel[0]._robotId) {
      robots.push('robot'); // legacy config
    } else if (bibi.bodyModel.length) {
      bibi.bodyModel.forEach(model => {
        if (!model._robotId) {
          console.error(
            'Multiple bodyModels has been defined with same or no names.' +
            'Please check bibi config file.'
          );
        }
        robots.push(model._robotId);
      });
    }

    return Promise.resolve({
      brain,
      brainType: path.extname(brainModelFile).substr(1),
      robots,
      populations: _.reduce(
        bibi.brainModel.populations,
        (acc, pop) => {
          let popObj;
          if (pop.element) {
            // list
            popObj = {
              list: pop.element.map(e => Number(e.toString()))
            };
          } else {
            // slice
            popObj = {
              to: Number(pop._to),
              from: Number(pop._from),
              step: Number(pop._step)
            };
          }
          return { ...acc, [pop._population]: popObj };
        },
        {}
      )
    });
  }

  async setBrain(brain, populations, removePopulations = false, newBrain?) {
    const [bibiFile, bibiFileName] = await this.getBibi();
    const bibi = bibiFile.bibi;
    let brainModelFile;
    if (bibi.brainModel) {

      if (populations.length > 0)
        bibi.brainModel.populations = populations.map(pop => {
          if (pop.list) {
            return {
              _population: pop.name,
              __prefix: bibi.brainModel.__prefix,
              '_xsi:type':
                (bibi.brainModel.__prefix
                  ? `${bibi.brainModel.__prefix}:`
                  : '') + 'List',
              element: pop.list.map(nb => ({
                __prefix: bibi.brainModel.__prefix,
                __text: `${nb}`
              }))
            };
          } else {
            return {
              _population: pop.name,
              _from: pop.from,
              _step: pop.step,
              _to: pop.to,
              __prefix: bibi.brainModel.__prefix,
              '_xsi:type':
                (bibi.brainModel.__prefix
                  ? `${bibi.brainModel.__prefix}:`
                  : '') + 'Range'
            };
          }
        });

      if (removePopulations) delete bibi.brainModel.populations;

      let brainModelFileText = bibi.brainModel.file.toString();
      let brainModelModelAttr = bibi.brainModel._model;

      if (newBrain) {
        brainModelFileText = newBrain.scriptPath;
        brainModelModelAttr = newBrain.name;

        bibi.brainModel = {
          __prefix: bibi.__prefix,
          _model: brainModelModelAttr,
          file: {
            __prefix: bibi.__prefix,
            __text: brainModelFileText,
          }
        };
      }

      brainModelFile = brainModelModelAttr ? path.join(brainModelModelAttr, brainModelFileText) : brainModelFileText;

    } else {

      bibi.brainModel = {
        __prefix: bibi.__prefix,
        file: {
          __prefix: bibi.__prefix,
          __text: undefined
        }
      };

      if (newBrain) {
        bibi.brainModel.file.__text = newBrain.isKnowledgeGraphBrain ? path.join(newBrain.name, newBrain.scriptPath) : newBrain.scriptPath;
        bibi.brainModel._model = newBrain.name;

        brainModelFile = path.join(newBrain.name, newBrain.scriptPath);
      } else {
        bibi.brainModel.file.__text = brainModelFile = 'brain_script.py';
      }
    }

    return Promise.all([
      this.saveFile(brainModelFile, brain),
      this.saveFile(bibiFileName, xmlFormat(new X2JS().js2xml(bibiFile)))
    ]).then(() => ({}));
  }

  async getTransferFunctions() {
    const bibi = (await this.getBibi())[0].bibi;

    let transferFunctions = bibi.transferFunction || [];
    if (transferFunctions && !Array.isArray(transferFunctions))
      transferFunctions = [transferFunctions];

    const tfsResponse = { data: {}, active: {} };

    return Promise.all(
      transferFunctions.map(tf =>
        this.getFile(tf._src, FILE_TYPE.TF)
        .then(tfFile => {
          let tfId = path.basename(tf._src);
          tfId = path.parse(tfId).name;
          tfsResponse.data[tfId] = tfFile.toString();
          tfsResponse.active[tfId] = tf._active || true;
        })
      )
    ).then(() => tfsResponse);
  }

  async saveTransferFunctions(transferFunctions: [{ code: string, active: boolean }]) {
    const [bibiFile, bibiFileName] = await this.getBibi();
    const bibi = bibiFile.bibi;
    if (!bibi['_xmlns:xsi']) {
      bibi['_xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
    }

    const tfs = transferFunctions.map(newTf => {
      const tfCode = newTf.code;
      const tfRegexp = /def +([^\\( ]*)/gm.exec(tfCode);
      const tfName = tfRegexp ? tfRegexp[1] : '';
      let bibiTransferFunctions = bibi.transferFunction || [];
      bibiTransferFunctions = Array.isArray(bibiTransferFunctions) ? bibiTransferFunctions : [bibiTransferFunctions];

      const bibiTf = bibiTransferFunctions.find(
          (bibiTf: { _src: string; }) =>
              path.basename(bibiTf._src, '.py') === tfName);

      let bibiTfActive = true;
      if (bibiTf !== undefined && bibiTf._active !== undefined)
        bibiTfActive = bibiTf._active;

      const tfActive = newTf.active !== undefined ? newTf.active : bibiTfActive;
      const tfPriority = bibiTf !== undefined && bibiTf._priority !== undefined ? bibiTf._priority : 0;

      return [`${tfName}.py`, tfCode, tfActive, tfPriority];
    });

    if (tfs && tfs.length)
      bibi.transferFunction = tfs.map(([tfName, _tfCode, active, priority]) => {
        return {
          _src: tfName,
          _active: active,
          _priority: priority,
          __prefix: bibi.__prefix,
          '_xsi:type':
            (bibi.__prefix ? `${bibi.__prefix}:` : '') +
            'PythonTransferFunction'
        };
      });
    else delete bibi.transferFunction;

    const tfFiles = tfs.map(([tfName, tfCode]) =>
      this.saveFile(tfName, tfCode)
    );

    return Promise.all([
      ...tfFiles,
      this.saveFile(bibiFileName, xmlFormat(new X2JS().js2xml(bibiFile)))
    ]).then(() => ({}));
  }

  async getCSVFiles() {
    const CSV_FOLDER_PREFIX = 'csv_records_';
    const files = await this.listFiles();
    const csvFolders = files
      .filter(f => f.type === 'folder')
      .filter(f => f.name.startsWith(CSV_FOLDER_PREFIX));

    const getRunName = folder =>
      folder.name.replace(new RegExp(`^${CSV_FOLDER_PREFIX}`), '');
    const csvFolderFiles = await Promise.all(
      csvFolders.map(folder =>
        this.listFiles(folder.name).then(files =>
          files.map(file => ({
            folder: getRunName(folder),
            ...file
          }))
        )
      )
    );
    const csvFiles = _.flatMap(csvFolderFiles).map(file => ({
      ...file,
      uuid: encodeURIComponent(file.uuid)
    }));

    return csvFiles;
  }

  protected abstract async getFile(filename, type);

  protected abstract async listFiles(dirname?: string): Promise<File[]>;

  protected abstract async saveFile(
    filename,
    fileContent,
    contentType?
  ): Promise<any>;

  protected abstract async getExcFileName();
}

class CloneExperimentService extends BaseExperimentService {
  constructor(
    experimentId,
    contextId,
    private storageRequestHandler: StorageRequestHandler
  ) {
    super(experimentId, contextId);
  }

  async getExcFileName() {
    return 'experiment_configuration.exc';
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
    private config,
    private proxyRequestHandler
  ) {
    super(experimentId, contextId);
  }

  async getExperimentFolder() {
    this.experimentFolder = path.dirname(
      path.join(this.config.experimentsPath, this.experimentId)
    );

    const experimentGlob = `${this.experimentFolder}/**/${
      this.experimentId
      }.exc`;
    const experimentFiles = await glob(experimentGlob);

    if (!experimentFiles.length)
      throw `Could not find experiment file of pattern ${experimentGlob}`;

    this.experimentDirectory = path.dirname(experimentFiles[0]);
    return this.experimentDirectory;
  }

  async getExcFileName() {
    return `${this.experimentId}.exc`;
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
