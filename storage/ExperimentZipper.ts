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

import _ from 'lodash';
import path from 'path';
import q from 'q';
import utils from './FS/utils';

// mocked in unit tests
// tslint:disable: prefer-const
let tmp = require('tmp'),
    fs = require('fs-extra'),
    zip = require('zip-a-folder'),
    mkdir = q.denodeify(fs.mkdir);
// tslint:enable: prefer-const

export class ExperimentZipper {

    constructor(protected storage, protected token, protected userId) { }

    async zipExperiment(experimentId) {
        const experiments = await this.storage.listExperiments(this.token, this.userId);
        if (experiments.find(exp => exp.name === experimentId)) {

            // in order to create a zip with a root folder as is the convention
            // the easiest way is to copy the entire experiment directory to tmp
            // inside a folder and zip the entire folder.
            const tmpFolder = tmp.dirSync();
            const experimentDirectoryCopy = path.join(tmpFolder.name, experimentId);
            await mkdir(experimentDirectoryCopy);
            fs.copySync(path.join(utils.storagePath, experimentId), experimentDirectoryCopy);

            const zipPath = tmp.fileSync();
            await zip.zip(tmpFolder.name, zipPath.name);
            return zipPath.name;
        }
    }
}
