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
import configurationManager from '../utils/configurationManager';

// mocked modules
// tslint:disable: prefer-const variable-name
let utils = require('../storage/FS/utils').default,
  StorageRequestHandler = require('../storage/requestHandler').default;
// tslint:enable: prefer-const variable-name

const fs = require('fs'),
  q = require('q'),
  path = require('path'),
  readFile = q.denodeify(fs.readFile),
  xsd = require('libxmljs2-xsd');

configurationManager.initialize();
let storageRequestHandler;
// not a constant, because mocked on unit test
// tslint:disable-next-line: prefer-const
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
        .listExperimentsSharedByUsers(req)
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

  getExcProperty(prop, defaultValue?: string) {
    const exists: boolean = Boolean(prop);
    const isNamespaced: boolean = exists && Boolean(prop.__text);
    if (isNamespaced)
      prop = prop.__text;
    return exists ? prop : defaultValue ? defaultValue : undefined;
  }

  getTags(strTags) {
    const tags = this.getExcProperty(strTags);
    return tags ? tags.split(/\s/) : [];
  }

  async buildExperiment(fileName, expName = '', isExperimentshared = false) {
    let experimentContent;
    try {
      experimentContent = await readFile(fileName, 'utf8');
    } catch (err) {
      console.error(err);
      return;
    }
    console.log(`Parsing experiment file ${fileName}`);
    const id = isExperimentshared ? expName : path.parse(fileName).name,
      fileConfigPath = isExperimentshared
        ? path.relative(utils.storagePath, fileName)
        : path.relative(this.experimentsPath, fileName),
      configPath = isExperimentshared
        ? utils.storagePath
        : this.experimentsPath,
      expPath = path.dirname(fileConfigPath);

    // XSD validation and parsing if possible
    let xsdSchemaLocation;
    try {
      xsdSchemaLocation = `${__dirname}/../xsds/ExDConfFile.xsd`;
      const schema = xsd.parseFile(xsdSchemaLocation);
      const validationErrors = schema.validate(experimentContent);
      if (validationErrors)
        console.warn(`Warning, xml validation of file ${fileName} against the xsd schema ${xsdSchemaLocation} failed due to Error: ${validationErrors}. XSD or XML are likely malformed. Falling back to parsing the xml without xsd validation.`);
    } catch (err) {
      console.warn(`Could not parse xsd with location ${xsdSchemaLocation}. Error that was thrown: ${err}`);
    }

    const exc: any = new X2JS().xml2js(experimentContent);
    return q.when(exc.ExD)
      .then(exc =>
        q.all([
          exc,
          readFile(
            path.join(configPath, expPath, exc.bibiConf._src),
            'utf8'
          ).then(data => new X2JS().xml2js(data))
        ])
      )
      .then(([exc, { bibi: bibi }]) => {
        let robotPaths = {};
        if (bibi.bodyModel) {
          if (!Array.isArray(bibi.bodyModel)) bibi.bodyModel = [bibi.bodyModel];

          if (bibi.bodyModel.length && !bibi.bodyModel[0]._robotId) {
            robotPaths = {
              robot: bibi.bodyModel[0].__text || bibi.bodyModel[0]
            }; // legacy config
          } else if (bibi.bodyModel.length) {
            bibi.bodyModel.forEach(model => {
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
          id,
          name: this.getExcProperty(exc.name) || id,
          isShared: isExperimentshared,
          thumbnail: this.getExcProperty(exc.thumbnail),
          robotPaths,
          path: expPath,
          physicsEngine:
            this.getExcProperty(exc.physicsEngine, 'ode'),
          tags: exc.tags ? this.getTags(exc.tags) : [],
          description:
            this.getExcProperty(exc.description, 'No description available for this experiment.'),
          experimentConfiguration: fileConfigPath,
          maturity:
            this.getExcProperty(exc.maturity) === 'production' ? 'production' : 'development',
          timeout: exc.timeout ? parseInt(this.getExcProperty(exc.timeout), 10) : 600,
          brainProcesses:
            this.getExcProperty(exc.bibiConf).processes ? this.getExcProperty(exc.bibiConf).processes : 1,
          cameraPose: exc.cameraPose && [
            ...['_x', '_y', '_z'].map(p => parseFloat(exc.cameraPose.cameraPosition[p])),
            ...['_x', '_y', '_z'].map(p => parseFloat(exc.cameraPose.cameraLookAt[p]))
          ],
          visualModel:
            exc.visualModel ? this.getExcProperty(exc.visualModel) : undefined,
          visualModelParams:
            exc.visualModel ? [
              ...['_x', '_y', '_z', '_ux', '_uy', '_uz'].map(
                p => exc.visualModel.visualPose[p]
              ),
              exc.visualModel.scale ?
                exc.visualModel.scale
                : 1
            ] : undefined
        };
      });
  }
}
