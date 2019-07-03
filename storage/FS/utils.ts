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

const STORAGE_PATH_ENV = 'STORAGE_PATH', // STORAGE_PATH variable
  DEFAULT_STORAGE_PATH = '$HOME/.opt/nrpStorage';

// storagePath = 'STORAGE_PATH' env variable is defined, or $HOME/.opt/nrpStorage by default
const storagePath =
  process.env[STORAGE_PATH_ENV] ||
  DEFAULT_STORAGE_PATH.replace(/\$([A-Z_a-z]*)/g, (m, v) => process.env[v] as string);

const customModelFolder = 'USER_DATA';

const generateUniqueExperimentId = (basename, suffix, existingExperiments) => {
  const newName = [basename, suffix].join('_');
  if (existingExperiments.includes(newName)) {
    suffix += 1;
    return generateUniqueExperimentId(basename, suffix, existingExperiments);
  } else {
    return newName;
  }
};

const getCurrentTimeAndDate = () => {
  function pad(n) {
    return n < 10 ? '0' + n : n;
  }
  const date = new Date();
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const dayWithYear = year + '-' + pad(month + 1) + '-' + pad(day);
  const time = date.toLocaleTimeString();
  return dayWithYear + 'T' + time;
};

// Returns true if the corresponding file is an image, false otherwise
const isImage = (filepath) => {
  const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif'];
  return (IMG_EXT.indexOf(path.extname(filepath)) !== -1);
};

export default {
  storagePath,
  generateUniqueExperimentId,
  getCurrentTimeAndDate,
  isImage
};
