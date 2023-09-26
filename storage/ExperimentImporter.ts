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

const path = require('path');
const jszip = require('jszip');
export class ExperimentImporter {
  constructor(
    protected storage,
    protected token,
    protected userId,
    protected contextId
  ) {}

  async createUniqueExperimentId(folderName) {
    return await this.storage.createUniqueExperimentId(
      this.token,
      this.userId,
      folderName,
      this.contextId
    );
  }

  async registerZippedExperiment(zipFileContent) {
    const zipContent = await jszip.loadAsync(zipFileContent);
    const folderBaseNames = new Set();
    zipContent.forEach((filepath, file) => {
      const parts = filepath.split(path.sep);
      if (parts.length > 1) folderBaseNames.add(parts[0]);
    });
    if (folderBaseNames.size === 0)
      throw 'Import error: the provided zip does contains no non-empty root folder. A non-empty experiment root folder is expected.';
    if (folderBaseNames.size > 1)
      throw 'Import error: the provided zip contains multiple folders at the root level. A unique experiment root folder is expected.';
    const zipBaseFolderName = Array.from(folderBaseNames)[0];
    const destFolderName = await this.createUniqueExperimentId(
      zipBaseFolderName
    );
    await this.storage.extractZip(zipContent, destFolderName);
    await this.storage.insertExperimentInDB(this.userId, destFolderName);
    const newName = await this.storage.renameExperiment(
      destFolderName,
      undefined,
      this.token,
      this.userId
    );
    return Promise.resolve({
      message: `The experiment folder has been succesfully imported`,
      zipBaseFolderName,
      destFolderName,
      newName
    });
  }

  async scanStorage(token) {
    return await this.storage.scanStorage(this.userId, this.token);
  }
}
