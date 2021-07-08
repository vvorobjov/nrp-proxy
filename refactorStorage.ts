'use strict';

import ModelsService from './storage/ModelsService';
import configurationManager from './utils/configurationManager';

const q = require('q'),
    path = require('path'),
    utils = require('./storage/FS/utils').default,
    fse = require('fs-extra'),
    DB = require('./storage/FS/DB').default,
    xml2js = require('xml2js'),
    modelsService = new ModelsService(),
    INTERNALS = ['FS_db', 'USER_DATA', 'KG_DATA_FOLDER', 'TEMPLATE_MODELS'];

configurationManager.initialize();
const config = configurationManager.loadConfigFile();
let storage;

const loadDependenciesInjection = async () => {
    const storageBasePath = path.resolve(
        path.join(__dirname, 'storage', config.storage)
    );
    const {Storage} = await import(path.join(storageBasePath, 'Storage'));
    storage = new Storage(config);
};

// find old custom models, extract their zips and update the entries in the DB
const refactorCustomModels = async () => {

    const oldModels = await DB.instance.models.find();
    return Promise.all(
        oldModels.map(async model => {
            // skip updated models
            if (model.isCustom !== undefined) {
                return;
            }
            const modelPath = model.path || model.fileName;
            const modelOwnerName = model.ownerName || model.token;
            const zipPath = path.join(utils.storagePath, 'USER_DATA', modelPath);
            let zip;
            try {
                zip = fse.readFileSync(zipPath);
            } catch (e) {
                console.warn(e);
                return Promise.resolve(model.fileName + ' not found');
            } finally {
                await DB.instance.models.remove(
                    {
                        $and: [
                            {$or: [{path: modelPath}, {fileName: modelPath}]},
                            {$or: [{ownerName: modelOwnerName}, {token: modelOwnerName}]},
                            {type: model.type}
                        ]
                    }
                );
            }

            const lightModel = {
                ownerId: modelOwnerName,
                type: model.type
            };
            const modelMetaData = await modelsService.getZipModelMetaData(lightModel, zip);
            modelMetaData.ownerName = modelOwnerName;
            await storage.createCustomModel(modelMetaData, zip, false);
            return fse.unlink(zipPath);
        })
    );
};

const generateUniqueName = (basename, directory) => {
    if (basename === '') {
        basename = 'robot';
    }
    let generatedName = basename;
    let i = 0;
    while (fse.existsSync(path.join(directory, generatedName))) {
        generatedName = basename + '_' + i;
        i += 1;
    }
    return generatedName;
};

const refactorBibi = async (bibiPath) => {
    const parser = new xml2js.Parser();
    const builder = new xml2js.Builder();

    const experimentFolder = path.dirname(bibiPath);
    const content = fse.readFileSync(bibiPath);
    const json = await q.denodeify(parser.parseString)(content);
    const bibi = json.bibi || json['ns1:bibi'];
    const bodyModels = bibi.bodyModel || bibi['ns1:bodyModel'];

    // const brainModels = bibi.brainModel || bibi['ns1:brainModel'];
    // if (brainModels) {
    //   for (const brainModel of brainModels) {
    //     const brainFile = brainModel.file || brainModel['ns1:file'];
    //     if (!fse.existsSync(path.join(experimentFolder, brainFile[0]))) {
    //       if (!fse.existsSync(path.join(config.modelsPath, brainFile[0]))) {
    //         throw 'unable to find brain model';
    //       }
    //       fse.copyFileSync(
    //         path.join(config.modelsPath, brainFile),
    //         path.join(experimentFolder, path.basename(brainFile[0]))
    //       );
    //       brainFile[0] = path.basename(brainFile[0]);
    //     }
    //   }
    // }

    if (bodyModels) {
        for (const [i, bodyModel] of bodyModels.entries()) {
            if (typeof bodyModel === 'string' || !('robotId' in bodyModel.$)) {
                let bodyModelValue = bodyModel;
                if (typeof bodyModelValue !== 'string') {
                    bodyModelValue = bodyModel._;
                }
                const robotId = generateUniqueName(path.dirname(bodyModelValue), experimentFolder);
                fse.ensureDirSync(path.join(experimentFolder, robotId));
                if (fse.existsSync(path.join(experimentFolder, bodyModelValue))) {
                    fse.renameSync(
                        path.join(experimentFolder, bodyModelValue),
                        path.join(experimentFolder, robotId, path.basename(bodyModelValue))
                    );
                } else if (fse.existsSync(path.join(config.modelsPath, bodyModelValue))) {
                    fse.copyFileSync(
                        path.join(config.modelsPath, bodyModelValue),
                        path.join(experimentFolder, robotId, path.basename(bodyModelValue))
                    );
                } else {
                    throw `unable to find body model in ${experimentFolder}`;
                }

                if (typeof bodyModel === 'string') {
                    bodyModels[i] = {
                        _: path.basename(bodyModel),
                        $: {robotId}
                    };
                } else {
                    bodyModel.$.robotId = robotId;
                    bodyModel._ = path.basename(bodyModelValue);
                }
            } else {
                const sdfName = path.basename(bodyModel._);
                const robotId = bodyModel.$.robotId;
                if (fse.existsSync(path.join(experimentFolder, robotId, sdfName))) {
                    bodyModel._ = sdfName;
                } else {
                    throw `unable to find body model in ${experimentFolder}`;
                }
            }

            delete bodyModels[i].$.isCustom;
        }
    }

    const xml = builder.buildObject(json);
    return fse.writeFile(bibiPath, xml);
};

const refactorExperiments = async () => {
    let experiments = await fse.readdir(utils.storagePath);
    experiments = experiments.filter(file => INTERNALS.indexOf(file) < 0);
    experiments.map(async exp => {
        const files = await q.denodeify(fse.readdir)(path.join(utils.storagePath, exp));
        files.filter(f => f.endsWith('.bibi')).map(f => refactorBibi(path.join(utils.storagePath, exp, f)));
    });
};

loadDependenciesInjection()
    .then(refactorCustomModels)
    .then(refactorExperiments)
    .catch(e => console.error(e));
