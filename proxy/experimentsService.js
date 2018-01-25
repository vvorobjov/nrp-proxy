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

const fs = require('fs'),
  q = require('q'),
  path = require('path'),
  readFile = q.denodeify(fs.readFile),
  X2JS = new require('x2js');

const cxml = require('cxml');
var parser = new cxml.Parser();

let ExDConfig = require('../xmlns/schemas.humanbrainproject.eu/SP10/2014/ExDConfig.js');

//not a constant, because mocked on unit test
let glob = q.denodeify(require('glob'));

class ExperimentsService {
  static get EXC_FILE_PATTERN() {
    return '*/*.exc';
  }

  constructor(experimentsPath) {
    this.experimentsPath = path.resolve(experimentsPath);
  }

  loadExperiments() {
    return glob(
      path.join(this.experimentsPath, ExperimentsService.EXC_FILE_PATTERN)
    ).then(excFiles =>
      q.all(excFiles.map(excFile => this.buildExperiment(excFile)))
    );
  }

  getExperimentFilePath(experimentPath, experimentFile) {
    return path.join(this.experimentsPath, experimentPath, experimentFile);
  }

  async buildExperiment(fileName) {
    let experimentContent = await readFile(fileName, 'utf8');

    let id = path.basename(fileName).split('.')[0],
      configPath = path.relative(this.experimentsPath, fileName),
      expPath = path.dirname(configPath);

    console.log(`Parsing experiment file ${fileName}`);

    return parser
      .parse(experimentContent, ExDConfig.document)
      .then(({ ExD: exc }) => {
        return q.all([
          exc,
          readFile(
            path.join(this.experimentsPath, expPath, exc.bibiConf.src),
            'utf8'
          ).then(data => new X2JS().xml2js(data))
        ]);
      })
      .then(([exc, { bibi: bibi }]) => {
        return {
          id: id,
          name: exc.name || id,
          thumbnail: exc.thumbnail,
          robotPath: path.dirname(bibi.bodyModel),
          path: expPath,
          physicsEngine:
            exc.physicsEngine._exists === false ? 'ode' : exc.physicsEngine,
          tags: exc.tags._exists === false ? [] : exc.tags,
          description:
            exc.description || 'No description available for this experiment.',
          experimentConfiguration: configPath,
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

module.exports = ExperimentsService;
