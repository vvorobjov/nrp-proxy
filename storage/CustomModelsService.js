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
  JSZip = require('jszip');

class CustomModelsService {
  logConfig(zip) {
    let zipfile = zip.file('model.config');
    if (!zipfile)
      return q.reject(
        `The model zip file is expected to have a 'model.config' file at the root level which contains the meta-data of the model.`
      );

    return zipfile
      .async('string')
      .then(q.denodeify(xml2js))
      .then(({ model: xml }) => ({
        name: xml.name && xml.name[0].trim(),
        description: xml.description && xml.description[0].trim(),
        sdf: xml.sdf[0]._
      }));
  }

  validateZip(zip) {
    var reject = ['name', 'description']
      .map(item => {
        if (!zip[item])
          return q.reject(
            `${item} missing from the model zip file. Please add it to the model.config of the model zip file in the root directory`
          );
      })
      .filter(item => item);
    if (reject.length) return reject[0];
    else return q.when();
  }

  logThumbnail(zip) {
    let zipfile = zip.file('thumbnail.png');
    if (!zipfile) return;

    return zipfile
      .async('base64')
      .then(data => 'data:image/png;base64,' + data);
  }

  getZipModelMetaData(filePath, fileContent) {
    return JSZip.loadAsync(fileContent).then(zip =>
      q
        .all([this.logConfig(zip), this.logThumbnail(zip)])
        .then(([config, thumbnail]) => ({
          name: config.name,
          description: config.description,
          thumbnail: thumbnail,
          path: encodeURIComponent(filePath) //escape slashes
        }))
        .catch(err =>
          q.reject(`Failed to load model '${filePath}'.\nErr: ${err}`)
        )
    );
  }

  extractModelSDFFromZip(fileContent) {
    return JSZip.loadAsync(fileContent).then(async zip => {
      let modelConfig = await this.logConfig(zip);
      let modelData = zip.file(modelConfig.sdf);
      if (!modelData)
        return q.reject(
          `The model zip file should have a file called ${modelData} at its root level`
        );
      return {
        data: await modelData.async('string'),
        name: modelData.name
      };
    });
  }
}

module.exports = CustomModelsService;
