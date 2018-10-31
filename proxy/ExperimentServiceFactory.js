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
  _ = require('lodash'),
  q = require('q'),
  fs = require('fs'),
  pd = require('pretty-data').pd,
  glob = q.denodeify(require('glob')),
  xmlFormat = xml => pd.xml(xml),
  X2JS = new require('x2js');

class ExperimentServiceFactory {
  constructor(storageRequestHandler, config, proxyRequestHandler) {
    this.config = config;
    this.storageRequestHandler = storageRequestHandler;
    this.proxyRequestHandler = proxyRequestHandler;
  }

  createExperimentService(experimentId, contextId, template) {
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
const FileType = {
  EXC: 'EXC',
  BIBI: 'BIBI',
  BRAIN: 'BRAIN',
  SM: 'SM',
  TF: 'TF'
};

class BaseExperimentService {
  constructor(experimentId, contextId) {
    this.experimentId = experimentId;
    this.contextId = contextId;
  }

  // eslint-disable-next-line no-unused-vars
  async getFile(filename, type) {
    throw 'Not implemented exception';
  }

  // eslint-disable-next-line no-unused-vars
  async saveFile(filename, fileContent, contentType = 'text/plain') {
    throw 'Not implemented exception';
  }

  // eslint-disable-next-line no-unused-vars
  async getExcFileName() {
    throw 'Not implemented exception';
  }

  async getExc() {
    const excFilename = await this.getExcFileName();
    const exc = await this.getFile(excFilename, FileType.EXC);
    const excstr = exc.toString();
    return [new X2JS().xml2js(excstr), excFilename, excstr];
  }

  async getBibi() {
    let exc = (await this.getExc())[0].ExD;
    let bibi = await this.getFile(exc.bibiConf._src, FileType.BIBI);
    return [new X2JS().xml2js(bibi.toString()), exc.bibiConf._src];
  }

  async getConfig() {
    // eslint-disable-next-line no-unused-vars
    let [{ ExD }, file, exc] = await this.getExc();

    let bibiConfSrc;
    try {
      let bibi = await this.getBibi();
      bibiConfSrc = bibi[1];
    } catch (err) {
      bibiConfSrc = undefined;
    }

    const getExDProp = prop => (prop && prop.__prefix ? prop.__text : prop);
    const maturity = getExDProp(ExD.maturity);
    let config = {
      timeout: getExDProp(ExD.timeout),
      name: getExDProp(ExD.name),
      thumbnail: getExDProp(ExD.thumbnail),
      description: getExDProp(ExD.description),
      maturity: maturity == 'production' ? maturity : 'development',
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
      bibiConfSrc: bibiConfSrc
    };

    if (ExD.visualModel) {
      let pose = ExD.visualModel.visualPose,
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
    let exc = (await this.getExc())[0].ExD;

    let smDict = {};
    let filePromises = [];
    if (exc.experimentControl) {
      let stateMachines = exc.experimentControl.stateMachine;
      if (!Array.isArray(exc.experimentControl.stateMachine))
        stateMachines = [stateMachines];

      for (let sm of stateMachines) {
        filePromises.push(
          this.getFile(sm._src, FileType.SM).then(
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
    let [excFile, excFileName] = await this.getExc();
    let exc = excFile.ExD;

    let promises = [];
    if (!_.isEmpty(stateMachines))
      exc.experimentControl = {
        __prefix: exc.__prefix,
        stateMachine: _.map(stateMachines, (sm, id) => ({
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
    let bibi = (await this.getBibi())[0].bibi;
    if (!bibi.brainModel) return null;
    let brainModelFile = bibi.brainModel.file.toString();
    let brain = (await this.getFile(
      brainModelFile.toString(),
      FileType.BRAIN
    )).toString();

    if (!bibi.brainModel.populations) bibi.brainModel.populations = [];
    else if (!Array.isArray(bibi.brainModel.populations))
      bibi.brainModel.populations = [bibi.brainModel.populations];

    let robots = [];
    if (!bibi.bodyModel) bibi.bodyModel = [];
    else if (!Array.isArray(bibi.bodyModel)) bibi.bodyModel = [bibi.bodyModel];

    if (bibi.bodyModel.length && !bibi.bodyModel[0]._robotId) {
      robots.push('robot'); // legacy config
    } else if (bibi.bodyModel.length) {
      bibi.bodyModel.forEach(function(model) {
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
      brain: brain,
      brainType: path.extname(brainModelFile).substr(1),
      robots: robots,
      populations: _.reduce(
        bibi.brainModel.populations,
        (acc, pop) => {
          let popObj;
          if (pop.element) {
            //list
            popObj = {
              list: pop.element.map(e => Number(e.toString()))
            };
          } else {
            //slice
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

  async setBrain(brain, populations) {
    let [bibiFile, bibiFileName] = await this.getBibi();
    let bibi = bibiFile.bibi;
    let brainModelFile = bibi.brainModel.file.toString();

    if (populations.length > 0)
      bibi.brainModel.populations = populations.map(pop => {
        if (pop.list) {
          return {
            _population: pop.name,
            __prefix: bibi.brainModel.__prefix,
            '_xsi:type':
              (bibi.brainModel.__prefix ? `${bibi.brainModel.__prefix}:` : '') +
              'List',
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
              (bibi.brainModel.__prefix ? `${bibi.brainModel.__prefix}:` : '') +
              'Range'
          };
        }
      });

    return Promise.all([
      this.saveFile(brainModelFile, brain),
      this.saveFile(bibiFileName, xmlFormat(new X2JS().js2xml(bibiFile)))
    ]).then(() => ({}));
  }

  async getTransferFunctions() {
    let bibi = (await this.getBibi())[0].bibi;

    let transferFunctions = bibi.transferFunction || [];
    if (transferFunctions && !Array.isArray(transferFunctions))
      transferFunctions = [transferFunctions];

    let tfsResponse = { data: {} };

    return Promise.all(
      transferFunctions.map(tf =>
        this.getFile(tf._src, FileType.TF).then(tfFile => {
          let tfId = path.basename(tf._src);
          tfId = tfId.split('.')[0];
          tfsResponse.data[tfId] = tfFile.toString();
        })
      )
    ).then(() => tfsResponse);
  }

  async saveTransferFunctions(transferFunctions) {
    let [bibiFile, bibiFileName] = await this.getBibi();
    let bibi = bibiFile.bibi;

    let tfs = transferFunctions.map(tfCode => {
      let tfName = /def +([^\\( ]*)/gm.exec(tfCode);
      if (tfName) tfName = tfName[1];
      return [`${tfName}.py`, tfCode];
    });

    if (tfs && tfs.length)
      bibi.transferFunction = tfs.map(([tfName]) => {
        return {
          _src: tfName,
          __prefix: bibi.__prefix,
          '_xsi:type':
            (bibi.__prefix ? `${bibi.__prefix}:` : '') +
            'PythonTransferFunction'
        };
      });
    else delete bibi.transferFunction;

    let tfFiles = tfs.map(([tfName, tfCode]) => this.saveFile(tfName, tfCode));

    return Promise.all([
      ...tfFiles,
      this.saveFile(bibiFileName, xmlFormat(new X2JS().js2xml(bibiFile)))
    ]).then(() => ({}));
  }
}

class CloneExperimentService extends BaseExperimentService {
  constructor(experimentId, contextId, storageRequestHandler) {
    super(experimentId, contextId);
    this.storageRequestHandler = storageRequestHandler;
  }

  async getExcFileName() {
    return 'experiment_configuration.exc';
  }

  // eslint-disable-next-line no-unused-vars
  async getFile(filename, filetype) {
    let response = await this.storageRequestHandler.getFile(
      filename,
      this.experimentId,
      this.contextId,
      true
    );
    return response.body;
  }

  async saveFile(filename, fileContent, contentType = 'text/plain') {
    let res = await this.storageRequestHandler.createOrUpdate(
      filename,
      fileContent,
      contentType,
      this.experimentId,
      this.contextId
    );
    return res;
  }
}
class TemplateExperimentService extends BaseExperimentService {
  constructor(experimentId, contextId, config, proxyRequestHandler) {
    super(experimentId, contextId);
    this.proxyRequestHandler = proxyRequestHandler;
    this.config = config;
  }

  async getExperimentFolder() {
    this.experimentFolder = path.dirname(
      path.join(this.config.experimentsPath, this.experimentId)
    );

    const experimentGlob = `${this.experimentFolder}/**/${this
      .experimentId}.exc`;
    const experimentFiles = await glob(experimentGlob);

    if (!experimentFiles.length)
      throw `Could not find experiment file of pattern ${experimentGlob}`;

    this.experimentDirectory = path.dirname(experimentFiles[0]);
  }

  async getExcFileName() {
    return `${this.experimentId}.exc`;
  }

  async getFile(filename, filetype) {
    if (!this.experimentDirectory) await this.getExperimentFolder();

    let fullfileName;
    if (filetype == FileType.BRAIN)
      fullfileName = path.join(this.config.modelsPath, filename);
    else fullfileName = path.join(this.experimentDirectory, filename);

    return q.denodeify(fs.readFile)(fullfileName, 'utf8');
  }

  // eslint-disable-next-line no-unused-vars
  async saveFile(filename, fileContent, contentType) {
    throw `Unexpected request to save '${fileContent}'. Template experiments cannot be modified`;
  }
}

module.exports = ExperimentServiceFactory;
