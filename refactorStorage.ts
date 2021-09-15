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

async function loadDependenciesInjection() {

    const storageBasePath = path.resolve(
        path.join(__dirname, 'storage', config.storage)
    );
    const { Storage } = await import(path.join(storageBasePath, 'Storage'));

    storage = new Storage(config);
}

// find old custom models, extract their zips and update the entries in the DB
async function refactorCustomModels() {

    const oldModels = await DB.instance.models.find();
    return Promise.all(
        oldModels.map(async model => {
            // skip updated models
            if (model.isCustom !== undefined) {
                return Promise.resolve(`Skip updated model ${model}`);
            }
            const modelPath = model.path || model.fileName;
            const modelOwnerName = model.ownerName || model.token;
            const zipPath = path.join(utils.storagePath, 'USER_DATA', modelPath);
            let zip;
            try {
                zip = fse.readFileSync(zipPath);
            } catch (e) {
                console.warn(e);
                return Promise.resolve(`${model.fileName} not found`);
            } finally {
                await DB.instance.models.remove(
                    {
                        $and: [
                            { $or: [{ path: modelPath }, { fileName: modelPath }] },
                            { $or: [{ ownerName: modelOwnerName }, { token: modelOwnerName }] },
                            { type: model.type }
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
            try {
                return fse.unlinkSync(zipPath);
            } catch (e) {
                return Promise.resolve(`${zipPath} not found`);
            }
        })
    );
}

const generateUniqueName = (basename, directory) => {
    // default model directory is 'robot'
    if (basename === '' || basename === '.') {
        basename = 'robot';
    }
    let generatedName = basename;
    let i = 0;
    while (fse.existsSync(path.join(directory, generatedName))) {
        generatedName = `${basename}_${i}`;
        i += 1;
    }
    return generatedName;
};

async function refactorBibi(bibiPath) {
    const builder = new xml2js.Builder();

    const experimentFolder = path.dirname(bibiPath);
    const content = fse.readFileSync(bibiPath);
    const json = await q.denodeify(xml2js.parseString)(content);
    if (json == null) {
        const msg = 'Skipping: Can\'t refactor! BIBI is empty.';
        console.warn(msg);
        return Promise.resolve(msg);
    }
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
                const bodyModelDir = path.dirname(bodyModelValue);
                const bodyModelFile = path.basename(bodyModelValue);

                const robotId = generateUniqueName(bodyModelDir, experimentFolder);
                // create new model directory named robotId
                fse.ensureDirSync(path.join(experimentFolder, robotId));

                const newBodyModelPath = path.join(experimentFolder, robotId, bodyModelFile);
                let oldBodyModelPath;

                // look for model in experiment folder
                if (fse.existsSync(oldBodyModelPath = path.join(experimentFolder, bodyModelDir, bodyModelFile)) ||
                    fse.existsSync(oldBodyModelPath = path.join(experimentFolder, 'robot', bodyModelFile))) {
                    fse.renameSync(
                        oldBodyModelPath, newBodyModelPath);
                } else if (fse.existsSync(oldBodyModelPath = path.join(config.modelsPath, bodyModelDir, bodyModelFile))) { // in $HBP/Models
                    fse.copyFileSync(
                        oldBodyModelPath, newBodyModelPath);
                } else {
                    throw `unable to find body model in ${experimentFolder}`;
                }
                // edit BIBI with new info
                if (typeof bodyModel === 'string') {
                    bodyModels[i] = {
                        _: bodyModelFile,
                        $: { robotId }
                    };
                } else {
                    bodyModel.$.robotId = robotId;
                    bodyModel._ = bodyModelFile;
                }
            } else {
                const bodyModelDir = path.dirname(bodyModel._);
                const bodyModelFile = path.basename(bodyModel._);

                const robotId = bodyModel.$.robotId; // robotId attribute is present

                // enforce robotId/bodyModelFile structure

                if (fse.existsSync(path.join(experimentFolder, robotId, bodyModelFile))) {
                    bodyModel._ = bodyModelFile; // normalize bodyModel value (i.e. SDF files, no paths)
                } else if (fse.existsSync(path.join(experimentFolder, bodyModelDir, bodyModelFile))) {
                    // rename bodyModelDir to robotId
                    fse.renameSync(
                        path.join(experimentFolder, bodyModelDir),
                        path.join(experimentFolder, robotId));
                    bodyModel._ = bodyModelFile;
                } else if (fse.existsSync(path.join(config.modelsPath, bodyModelDir, bodyModelFile))) {
                    fse.ensureDirSync(path.join(experimentFolder, robotId));
                    // copy bodyModelFile from $HBP/Models
                    fse.copyFileSync(
                        path.join(config.modelsPath, bodyModelDir, bodyModelFile),
                        path.join(experimentFolder, robotId, bodyModelFile));
                } else {
                    throw `unable to find body model in ${experimentFolder}`;
                }
            }
            // delete isCustom attribute
            delete bodyModels[i].$.isCustom;
        }
    }

    const xml = builder.buildObject(json);
    return fse.writeFile(bibiPath, xml);
}

async function refactorExperiments() {
    let experiments = await fse.readdir(utils.storagePath);
    experiments = experiments.filter(file => INTERNALS.indexOf(file) < 0);

    return Promise.all(
        experiments.map(async exp => {
            let files;
            try {
                files = await fse.readdir(path.join(utils.storagePath, exp));
            } catch (e) {
                const msg = `Skipping: ${exp} is not a directory.`;
                console.warn(msg);
                return Promise.resolve(msg);
            }
            if (files) {
                const bibis = files.filter(f => f.endsWith('.bibi'));
                const multipleBibiWarning = bibis.length > 1 ? ' More than one BIBI file has been found; using:' : '';
                if (bibis.length === 0) {
                    console.debug(`Skipping: "${exp}". NO BIBI found`);
                    return Promise.resolve();
                }
                console.debug(`Processing: "${exp}".${multipleBibiWarning} BIBI: "${bibis[0]}"`);
                try {
                    await refactorBibi(path.join(utils.storagePath, exp, bibis[0]));
                    return Promise.resolve();
                } catch (err) {
                    const msg = `ERROR: ${err}`;
                    console.warn(msg);
                    return Promise.resolve(msg);
                }
            }
        })
    );
}

async function main() {
    try {
        await loadDependenciesInjection();

        console.log('==REFACTORING CUSTOM MODELS==');
        await refactorCustomModels();
        console.log('==COMPLETE==');
        console.log();
        console.log('==REFACTORING EXPERIMENTS==');
        await refactorExperiments();
        console.log('==COMPLETE==');

    } catch (error) {
        console.error(error);
    }
}

main()
    .then(_ => process.exit(0));
