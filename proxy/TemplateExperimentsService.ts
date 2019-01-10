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
import StorageRequestHandler_original from '../storage/requestHandler';
import utils_original from '../storage/FS/utils';
import configurationManager from '../utils/configurationManager';

// mocked modules
let utils = utils_original,
  StorageRequestHandler = StorageRequestHandler_original;

const fs = require('fs'),
  q = require('q'),
  path = require('path'),
  readFile = q.denodeify(fs.readFile);

configurationManager.initialize();
var storageRequestHandler;
const cxml = require('cxml');
var parser = new cxml.Parser();

let ExDConfig = require('../xmlns/schemas.humanbrainproject.eu/SP10/2014/ExDConfig.js');

//not a constant, because mocked on unit test
let glob = q.denodeify(require('glob'));

export default class ExperimentsService {
  static get EXC_FILE_PATTERN() {
    return '*/*.exc';
  }

  private experimentsPath: string;

  constructor(private config, experimentsPath) {
    this.experimentsPath = path.resolve(experimentsPath);
    storageRequestHandler = new StorageRequestHandler(config);
  }

  loadExperiments() {
    return glob(
      path.join(this.experimentsPath, ExperimentsService.EXC_FILE_PATTERN)
    ).then(excFiles =>
      q.all(excFiles.map(excFile => this.buildExperiment(excFile)))
    );
  }

  loadSharedExperiments(req) {
    return q.all(
      storageRequestHandler
        .listExperimentsSharedByUser(req)
        .then(exps =>
          exps.map(exp =>
            glob(
              path.join(utils.storagePath, exp.name + '/*.exc')
            ).then(pathFile =>
              this.buildExperiment(pathFile[0], exp.name, true)
            )
          )
        )
    );
  }
  getSharedExperimentFilePath(experimentPath, experimentFile) {
    return path.join(utils.storagePath, experimentPath, experimentFile);
  }

  getExperimentFilePath(experimentPath, experimentFile) {
    return path.join(this.experimentsPath, experimentPath, experimentFile);
  }

  async buildExperiment(fileName, expName = '', isExperimentShared = false) {
    let experimentContent;
    try {
      experimentContent = await readFile(fileName, 'utf8');
    } catch (err) {
      console.error(err);
      return;
    }
    console.log(`Parsing experiment file ${fileName}`);
    const id = isExperimentShared ? expName : path.parse(fileName).name,
      fileConfigPath = isExperimentShared
        ? path.relative(utils.storagePath, fileName)
        : path.relative(this.experimentsPath, fileName),
      configPath = isExperimentShared
        ? utils.storagePath
        : this.experimentsPath,
      expPath = path.dirname(fileConfigPath);
    return parser
      .parse(experimentContent, ExDConfig.document)
      .then(({ ExD: exc }) => {
        return q.all([
          exc,
          readFile(
            path.join(configPath, expPath, exc.bibiConf.src),
            'utf8'
          ).then(data => new X2JS().xml2js(data))
        ]);
      })
      .then(([exc, { bibi: bibi }]) => {
        let robotPaths = {};
        if (bibi.bodyModel) {
          if (!Array.isArray(bibi.bodyModel)) bibi.bodyModel = [bibi.bodyModel];

          if (bibi.bodyModel.length && !bibi.bodyModel[0]._robotId) {
            robotPaths['robot'] = bibi.bodyModel[0].__text || bibi.bodyModel[0]; // legacy config
          } else if (bibi.bodyModel.length) {
            bibi.bodyModel.forEach(function(model) {
              if (!model._robotId) {
                console.error(
                  'Multiple bodyModels has been defined with same or no names.' +
                    'Please check bibi config file.'
                );
              }
              robotPaths[model._robotId] = model.__text || model;
            });
          }
        }

        return {
          id: id,
          name: exc.name || id,
          isShared: isExperimentShared,
          thumbnail: exc.thumbnail,
          robotPaths: robotPaths,
          path: expPath,
          physicsEngine:
            exc.physicsEngine._exists === false ? 'ode' : exc.physicsEngine,
          tags: exc.tags._exists === false ? [] : exc.tags,
          description:
            exc.description || 'No description available for this experiment.',
          experimentConfiguration: fileConfigPath,
          maturity: exc.maturity == 'production' ? 'production' : 'development',
          timeout: exc.timeout || 600,
          brainProcesses:
            exc.bibiConf.processes._exists === false
              ? 1
              : exc.bibiConf.processes,
          cameraPose: exc.cameraPose && [
            ...['x', 'y', 'z'].map(p => exc.cameraPose.cameraPosition[p]),
            ...['x', 'y', 'z'].map(p => exc.cameraPose.cameraLookAt[p])
          ],
          visualModel:
            exc.visualModel._exists === false ? undefined : exc.visualModel.src,
          visualModelParams:
            exc.visualModel._exists === false
              ? undefined
              : [
                  ...['x', 'y', 'z', 'ux', 'uy', 'uz'].map(
                    p => exc.visualModel.visualPose[p]
                  ),
                  exc.visualModel.scale._exists === false
                    ? 1
                    : exc.visualModel.scale
                ]
        };
      });
  }
}
