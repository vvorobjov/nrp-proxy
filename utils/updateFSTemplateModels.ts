'use strict';

const q = require('q'),
  path = require('path'),
  utils = require('../storage/FS/utils').default,
  fs = require('fs-extra'),
  DB = require('../storage/FS/DB').default,
  xml2js = require('xml2js').parseString,
  TEMPLATE_MODELS_FOLDER = 'TEMPLATE_MODELS',
  templateModelAbsPath = path.join(utils.storagePath, TEMPLATE_MODELS_FOLDER);

const getTemplateModelsFolder = async (modelType) => {
  const modelsFolder = path.join(templateModelAbsPath, modelType);
  return fs.readdirSync(modelsFolder);
};

const updateTemplateModels = (models) => {
  models.map(model => {
    return DB.instance.models
      .findOne({ $and: [{ name: model.name }, { type: model.type }] })
      .then(existingModel => {
        if (!existingModel) {
          DB.instance.models
            .insert({
              name: model.name,
              type: model.type,
              path: model.path,
              isCustom: false
            })
            .then(() => console.log(`Inserted model ${model.name} into the database`))
            .catch(e => console.warn(`Failed to insert model ${model.name}:`, e));
        }
      });
  });
};

const getModelMetaData = async (folder, modelType) => {
  const configFileRelPath = path.join(folder, 'model.config');
  const configFileFullPath = path.join(templateModelAbsPath, modelType, configFileRelPath);
  let configXml;

  try {
    configXml = fs.readFileSync(configFileFullPath);
  } catch {
    return Promise.reject(
      `The model is expected to have a 'model.config' file inside the root folder which contains the meta-data of the model. The root folder was: ${folder}`
    );
  }

  const configJson = await q.denodeify(xml2js)(configXml);
  const config = {
    name: configJson.model.name && configJson.model.name[0].trim(),
    description: configJson.model.description && configJson.model.description[0].trim(),
    sdf: configJson.model.sdf ? configJson.model.sdf[0]._ : undefined,
    configPath: configFileRelPath.name
  };
  const modelName = config.name.toLowerCase().replace(/ /g, '_');
  return {
    name: modelName,
    type: modelType,
    path: folder, // escape slashes
  };

};

const scanTemplateModels = async (modelType) => {
  const files = await fs.readdir(path.join(templateModelAbsPath, modelType));
  const modelFolders = files
    .filter(f =>
      fs.statSync(path.join(templateModelAbsPath, modelType, f)).isDirectory()
    ).map(f => path.join(modelType, f));
  const models = await DB.instance.models.find({$and: [{ isCustom: false }, { type: modelType }] });
  const deletedModels = models.filter(m => modelFolders.indexOf(m.path) === -1);
  return deletedModels.map(m => {
    console.log(`Removed model ${m.name} from the database`);
    return DB.instance.models.remove({ name: m.name });
  });
};

const main = async () => {
  ['brains', 'environments', 'robots'].map(async type => {
    const folders = await getTemplateModelsFolder(type);
    const models = await Promise.all(folders.map(folder => getModelMetaData(folder, type)));
    try {
      await scanTemplateModels(type);
      updateTemplateModels(models);
    } catch (e) {
      console.error('Failed to update template models\' DB:', e);
    }
  });
};

main();
