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
  X2JS = new require('x2js');

class ExperimentServiceFactory {
  constructor(storageRequestHandler) {
    this.storageRequestHandler = storageRequestHandler;
  }

  createExperimentService(experimentId, contextId) {
    return new ExperimentService(
      this.storageRequestHandler,
      experimentId,
      contextId
    );
  }
}

class ExperimentService {
  constructor(storageRequestHandler, experimentId, contextId) {
    this.storageRequestHandler = storageRequestHandler;
    this.experimentId = experimentId;
    this.contextId = contextId;
  }

  async getFile(filename) {
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

  async getExc() {
    let exc = await this.getFile('experiment_configuration.exc');
    return [new X2JS().xml2js(exc.toString()), 'experiment_configuration.exc'];
  }

  async getBibi() {
    let exc = (await this.getExc())[0].ExD;
    let bibi = await this.getFile(exc.bibiConf._src);
    return [new X2JS().xml2js(bibi.toString()), exc.bibiConf._src];
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
          this.getFile(sm._src).then(
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
      this.saveFile(excFileName, new X2JS().js2xml(excFile))
    ]).then(() => ({}));
  }

  async getBrain() {
    let bibi = (await this.getBibi())[0].bibi;
    let brainModelFile = bibi.brainModel.file.toString();
    let brain = (await this.getFile(brainModelFile.toString())).toString();

    if (!bibi.brainModel.populations) bibi.brainModel.populations = [];
    else if (!Array.isArray(bibi.brainModel.populations))
      bibi.brainModel.populations = [bibi.brainModel.populations];

    return Promise.resolve({
      brain: brain,
      brainType: path.extname(brainModelFile).substr(1),
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

    bibi.brainModel.populations = populations.map(pop => {
      if (pop.list) {
        return Promise.resolve({
          _population: pop.name,
          __prefix: bibi.brainModel.__prefix,
          '_xsi:type':
            (bibi.brainModel.__prefix ? `${bibi.brainModel.__prefix}:` : '') +
            'List',
          element: pop.list.map(nb => ({
            __prefix: 'ns1',
            __text: `${nb}`
          }))
        });
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
      this.saveFile(bibiFileName, new X2JS().js2xml(bibiFile))
    ]).then(() => ({}));
  }

  async getTransferFunctions() {
    let bibi = (await this.getBibi())[0].bibi;

    let transferFunctions = bibi.transferFunction;
    if (transferFunctions && !Array.isArray(transferFunctions))
      transferFunctions = [transferFunctions];

    let tfsResponse = { active: {}, data: {} };

    return Promise.all(
      transferFunctions.map(tf =>
        this.getFile(tf._src).then(tfFile => {
          let tfId = path.basename(tf._src);
          tfsResponse.data[tfId] = tfFile.toString();
          tfsResponse.active[tfId];
        })
      )
    ).then(() => tfsResponse);
  }
}

module.exports = ExperimentServiceFactory;
