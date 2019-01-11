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
  xml2js = require('xml2js').parseString,
  _ = require('lodash'),
  path = require('path'),
  base64 = require('file-base64'),
  q = require('q');

// not a constant, because mocked on unit test
// tslint:disable-next-line: prefer-const
let glob = require('glob');

abstract class ModelLoader {
  private models = [];

  get modelList() {
    return this.models;
  }
  abstract get modelType(): string;

  abstract get filePattern(): string;

  abstract parseFile(file): Promise<any>;

  loadModels(modelsPath) {
    const loadModel = f =>
      this.parseFile(f).then(m => {
        if (m) {
          m.path = path.relative(modelsPath, f);
          m.id = m.path.split(path.sep)[1];
        }
        return m;
      });

    return (this.models = q.denodeify(glob)(
      path.join(modelsPath, this.filePattern)
    )
      .then(files =>
        q.all(
          _(files)
            .map(_.bind(loadModel, this))
            .value()
        )
      )
      .then(models => models.filter(m => !!m))
      .catch(err =>
        console.error(`Failed to load ${this.modelType}. Error: ${err}`)
      ));
  }
}

class BrainsModelLoader extends ModelLoader {
  static get maturity_regexp() {
    return /\n+maturity *: *([^\n]*)/gi;
  }

  get modelType() {
    return 'brains';
  }
  get filePattern() {
    return `${this.modelType}/*.py`;
  }

  parseFileContent(fileContent) {
    const firstComment = fileContent.match(/^"""([^"]*)"""/m);
    return firstComment && firstComment[1].trim();
  }

  parseFile(file) {
    return q.denodeify(fs.readFile)(file, 'utf8')
      .then(fileContent => this.parseFileContent(fileContent))
      .then(docString => {
        const name = path.basename(file, path.extname(file));
        const maturityDocString = BrainsModelLoader.maturity_regexp.exec(
          docString
        );

        let description = docString,
          maturity = 'development';

        if (maturityDocString) {
          // doc string contains a maturity level, split it into adequate fields
          if (maturityDocString[1] === 'production') maturity = 'production';
          description = docString.replace(
            BrainsModelLoader.maturity_regexp,
            ''
          );
        }

        return {
          name,
          description,
          maturity
        };
      })
      .catch(err => console.error(`Failed to read  ${file}. Error: ${err}`));
  }
}

abstract class XmlConfigModelLoader extends ModelLoader {
  get filePattern() {
    return `${this.modelType}/*/model.config`;
  }

  parseFile(file) {
    const props2read = ['name', 'description', 'thumbnail', 'maturity'];

    const loadThumbnail = (model, directory) => {
      if (!model.thumbnail) return model;

      return q.denodeify(base64.encode)(
        path.join(directory, model.thumbnail)
      ).then(b64 => {
        model.thumbnail = 'data:image;base64,' + b64;
        return model;
      });
    };

    return q.denodeify(fs.readFile)(file, 'utf8')
      .then(q.denodeify(xml2js))
      .then(json => {
        const mapped = _.fromPairs(
          props2read.map(p => [
            p,
            _(json.model[p])
              .join(',')
              .trim() || null
          ])
        );
        if (mapped.maturity !== 'production') mapped.maturity = 'development';
        return mapped;
      })
      .then(model => loadThumbnail(model, path.dirname(file)))
      .catch(err => console.error(`Failed to read  ${file}. Error: ${err}`));
  }
}

class RobotsModelLoader extends XmlConfigModelLoader {
  get modelType() {
    return 'robots';
  }
}

class EnvironmentsModelLoader extends XmlConfigModelLoader {
  get modelType() {
    return 'environments';
  }
}

export default class ModelsService {
  private modelsPath: string;
  private moduleLoaders: ModelLoader[];

  constructor(modelsPath) {
    this.modelsPath = path.resolve(modelsPath);

    this.moduleLoaders = _([
      new RobotsModelLoader(),
      new EnvironmentsModelLoader(),
      new BrainsModelLoader()
    ])
      .map(loader => [loader.modelType, loader])
      .fromPairs()
      .value();
  }

  loadModels() {
    return q.all(
      _(this.moduleLoaders)
        .map(loader => loader.loadModels(this.modelsPath))
        .value()
    );
  }

  getModels(modelType) {
    if (this.moduleLoaders[modelType])
      return q.resolve(this.moduleLoaders[modelType].modelList);
    return q.reject(`Model ${modelType} not found`);
  }

  async getModelConfig(modelType, modelId) {
    const models = await this.getModels(modelType);
    const model = models.find(m => m.id === modelId);
    if (!model) throw `No ${modelType} named ${modelId} was found.`;
    return path.join(this.modelsPath, model.path);
  }
}
