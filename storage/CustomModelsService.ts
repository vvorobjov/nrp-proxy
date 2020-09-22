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

const xml2js = require('xml2js').parseString,
  q = require('q'),
  path = require('path'),
  fs = require('fs-extra'),
  base64 = require('file-base64');

// mocked in tests
// tslint:disable-next-line: prefer-const
let jszip = require('jszip');

export default class CustomModelsService {
  logConfig(zip, basename) {
    const exception = q.reject(
      `The model zip file is expected to have a 'model.config' file inside the root folder which contains the meta-data of the model.`
    );

    const configFileRelPath = zip.file(path.join(basename, 'model.config'));
    if (!configFileRelPath) return exception;

    return configFileRelPath
      .async('string')
      .then(q.denodeify(xml2js))
      .then(({ model: xml }) => ({
        name: xml.name && xml.name[0].trim(),
        description: xml.description && xml.description[0].trim(),
        sdf: xml.sdf ? xml.sdf[0]._ : undefined,
        brain: xml.brain ? xml.brain[0] : undefined,
        configPath: configFileRelPath.name
      }));
  }

  validateZip(zip) {
    const reject = ['name', 'description']
      .map(item => {
        if (!zip[item])
          return q.reject(
            `${item} missing from the model zip file. Please add it to the model.config of the model zip file inside the root directory`
          );
      })
      .filter(item => item);
    if (reject.length) return reject[0];
    else return q.when();
  }

  logThumbnail(zip, basename) {
    const zipfile = zip.file(path.join(basename, 'thumbnail.png'));
    if (!zipfile) return;

    return zipfile
      .async('base64')
      .then(data => 'data:image/png;base64,' + data);
  }

  getZipModelMetaData(model, fileContent) {
    return jszip.loadAsync(fileContent).then(async zip => {
      const exception = q.reject(
        `The model zip file is expected to have a 'model.config' file inside the root folder which contains the meta-data of the model.`
      );

      try {
        const basename = this.getZipBasename(zip);
        if (!basename || basename === 'model.config') return exception;
        const defaultThumbnail = await q.denodeify(base64.encode)(path.resolve(__dirname, '../img/brain.png'))
          .then(b64 => 'data:image;base64,' + b64);

        return q
          .all([
            this.logConfig(zip, basename),
            this.logThumbnail(zip, basename)
          ])
          .then(async ([config, thumbnail]) => {
            if (config.name === undefined || config.name === '') {
              throw 'name is missing';
            }
            return {
              name: config.name.toLowerCase().replace(/ /g, '_'),
              displayName: config.name,
              ownerId: model.ownerId,
              type: model.type,
              fileName: path.basename(model.path),
              isShared: model.isShared,
              isCustom: true,
              description: config.description,
              thumbnail: thumbnail ? thumbnail : defaultThumbnail,
              path: model.path, // escape slashes
              script: config.brain ? await zip.file(path.join(basename, config.brain)).async('text').then(data => data) : undefined,
              sdf: !config.brain ? path.join(basename, config.sdf) : undefined,
              configPath: config.configPath
            };
          })
          .catch(err =>
            q.reject(`Failed to load model '${model.location}'.\nErr: ${err}`)
          );
      } catch (err) {
        return exception;
      }
    }
    );
  }

  extractFileFromZip(fileContent, fileName) {
    return jszip.loadAsync(fileContent).then(async zip => {
      const basename = this.getZipBasename(zip);
      const modelData = zip.file(path.join(basename, fileName));
      if (!modelData)
        return q.reject(
          `The model zip file should have a file called ${fileName} inside the root folder`
        );
      return await modelData.async('string');
    });
  }

  async extractZip(fileContent) {
    const contents = await jszip.loadAsync(fileContent);
    const mapFile = async filename => {
      if (path.parse(filename).dir !== '' && filename.substr(-1) !== path.sep) {
        const content = await contents.file(filename).async('nodebuffer');
        const dest = path.join('/tmp/nrp-simulation-dir/assets', filename);
        if (!await fs.exists(path.dirname(dest))) {
          await fs.ensureDir(path.dirname(dest));
        }
        await fs.writeFile(dest, content);
      }
    };
    const files = Object.keys(contents.files).map(mapFile);
    return q.all(files);
  }

  getZipBasename(zip) {
    return zip
      .filter((relativePath, file) => file.name.includes('model.config'))[0]
      .name.split(path.sep)[0];
  }

  getFilesWithExt(zipRawData, ext) {
    return jszip.loadAsync(zipRawData).then(async zip =>
      zip.filter((relativePath, file) => file.name.toLowerCase().endsWith(ext))
    );
  }

  extractModelMetadataFromZip(fileContent, type?) {
    return jszip.loadAsync(fileContent).then(async zip => {
      const exception = q.reject(
        `Error: Zip structure is wrong. Could not find model.config.`
      );

      const basename = this.getZipBasename(zip);
      if (!basename || basename === 'model.config') return exception;

      const modelConfig = await this.logConfig(zip, basename);
      let modelData;
      if (type === 'brainPath') {
        modelData = zip.file(path.join(basename, modelConfig.brain));
      } else {
        modelData = zip.file(path.join(basename, modelConfig.sdf));
      }
      if (!modelData)
        return q.reject(
          `There is a problem with the ${modelConfig.name} zip file. Make sure that the file (py or sdf) the model.config points to is in the zip.`
        );

      return {
        data: await modelData.async('string'),
        name: type === 'robotPath'
          ? modelData.name
          : modelData.name.split(path.sep)[1],
        relPath: modelData.name,
        modelConfig: await zip
          .file(path.join(basename, 'model.config'))
          .async('string')
          .then(q.denodeify(xml2js))
      };
    });
  }
}
