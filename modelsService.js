'use strict';

const fs = require('fs'),
  xml2js = require('xml2js').parseString,
  _ = require('lodash'),
  path = require('path'),
  base64 = require('file-base64'),
  q = require('q');

//not a constant, because mocked on unit test
let glob = require('glob');


class ModelLoader {
  constructor() { this.models = []; }

  get modelList() { return this.models; }
  get modelType() { throw 'Not implemented'; }
  get filePattern() { throw 'Not implemented'; }
  parseFile(file) { throw 'Not implemented'; }

  loadModels(modelsPath) {
    return this.models = q.denodeify(glob)(path.join(modelsPath, this.filePattern))
      .then(files => q.all(_(files).map(_.bind(this.parseFile, this)).value()))
      .then(models => models.filter(m => !!m))
      .catch(err => console.error(`Failed to load ${this.modelType}. Error: ${err}`));
  }
}

class BrainsModelLoader extends ModelLoader {
  get modelType() { return 'brains'; }
  get filePattern() { return `${this.modelType}/*.py`; }

  parseFileContent(fileContent) {
    let firstComment = fileContent.match(/^"""([^\"]*)"""/m);
    return firstComment && firstComment[1].trim();
  }

  parseFile(file) {
    return q.denodeify(fs.readFile)(file, 'utf8')
      .then(fileContent => this.parseFileContent(fileContent))
      .then(desc => {
        return {
          name: path.basename(file, path.extname(file)),
          description: desc
        };
      })
      .catch(err => console.error(`Failed to read  ${file}. Error: ${err}`));
  }
}

class XmlConfigModelLoader extends ModelLoader {
  get filePattern() { return `${this.modelType}/*/model.config`; }

  parseFile(file) {
    const props2read = ['name', 'description', 'thumbnail'];

    let loadThumbnail = (model, directory) => {
      if (!model.thumbnail)
        return model;

      return q.denodeify(base64.encode)(path.join(directory, model.thumbnail))
        .then(b64 => {
          model.thumbnail = 'data:image;base64,' + b64;
          return model;
        });
    };

    return q.denodeify(fs.readFile)(file, 'utf8')
      .then(q.denodeify(xml2js))
      .then(json => _.fromPairs(props2read.map(p => [p, _(json.model[p]).join(',').trim() || null])))
      .then(model => loadThumbnail(model, path.dirname(file)))
      .catch(err => console.error(`Failed to read  ${file}. Error: ${err}`));
  }
}

class RobotsModelLoader extends XmlConfigModelLoader {
  get modelType() { return 'robots'; }
}

class EnvironmentsModelLoader extends XmlConfigModelLoader {
  get modelType() { return 'environments'; }
}

class ModelsService {

  constructor(modelsPath) {
    this.modelsPath = path.resolve(modelsPath);

    this.moduleLoaders = _([
      new RobotsModelLoader(),
      new EnvironmentsModelLoader(),
      new BrainsModelLoader()
    ]).map(loader => [loader.modelType, loader])
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
}

module.exports = ModelsService;