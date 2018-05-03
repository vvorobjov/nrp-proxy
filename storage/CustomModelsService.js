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
  JSZip = require('jszip'),
  path = require('path');

class CustomModelsService {
  logConfig(zip, basename) {
    const exception = q.reject(
      `The model zip file is expected to have a 'model.config' file inside the root folder which contains the meta-data of the model.`
    );

    let zipfile = zip.file(path.join(basename, 'model.config'));
    if (!zipfile) return exception;

    return zipfile
      .async('string')
      .then(q.denodeify(xml2js))
      .then(({ model: xml }) => ({
        name: xml.name && xml.name[0].trim(),
        description: xml.description && xml.description[0].trim(),
        sdf: xml.sdf ? xml.sdf[0]._ : undefined,
        brain: xml.brain ? xml.brain[0] : undefined
      }));
  }

  validateZip(zip) {
    var reject = ['name', 'description']
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
    let zipfile = zip.file(path.join(basename, 'thumbnail.png'));
    if (!zipfile) return;

    return zipfile
      .async('base64')
      .then(data => 'data:image/png;base64,' + data);
  }

  getZipModelMetaData(filePath, fileContent, fileName = undefined) {
    return JSZip.loadAsync(fileContent).then(zip => {
      const exception = q.reject(
        `The model zip file is expected to have a 'model.config' file inside the root folder which contains the meta-data of the model.`
      );

      const basename = this.getZipBasename(zip);
      if (!basename || basename == 'model.config') return exception;

      return q
        .all([this.logConfig(zip, basename), this.logThumbnail(zip, basename)])
        .then(([config, thumbnail]) => ({
          name: config.name,
          description: config.description,
          thumbnail: thumbnail,
          path: encodeURIComponent(filePath), //escape slashes
          fileName: fileName
        }))
        .catch(err =>
          q.reject(`Failed to load model '${filePath}'.\nErr: ${err}`)
        );
    });
  }

  extractFileFromZip(fileContent, fileName) {
    return JSZip.loadAsync(fileContent).then(async zip => {
      const basename = this.getZipBasename(zip);
      let modelData = zip.file(path.join(basename, fileName));
      if (!modelData)
        return q.reject(
          `The model zip file should have a file called ${fileName} inside the root folder`
        );
      return await modelData.async('string');
    });
  }

  getZipBasename(zip) {
    return zip
      .filter((relativePath, file) => file.name.includes('model.config'))[0]
      .name.split(path.sep)[0];
  }

  extractModelMetadataFromZip(fileContent, brain = undefined) {
    return JSZip.loadAsync(fileContent).then(async zip => {
      const exception = q.reject(
        `Error: Zip structure is wrong. Could not find model.config.`
      );

      const basename = this.getZipBasename(zip);
      if (!basename || basename == 'model.config') return exception;

      let modelConfig = await this.logConfig(zip, basename);
      let modelData;
      if (brain) {
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
        name: modelData.name.split(path.sep)[1],
        modelConfig: await zip
          .file(path.join(basename, 'model.config'))
          .async('string')
          .then(q.denodeify(xml2js))
      };
    });
  }
}

module.exports = CustomModelsService;
