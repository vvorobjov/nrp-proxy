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

const q = require('q'),
  uuid = require('uuid/v4'),
  path = require('path'),
  DB = require(path.join(__dirname, '../storage/FS/DB.js'));

let argv = require('minimist')(process.argv.slice(2));

if (!argv.user || !argv.password) {
  console.error(
    `Error: arguments 'user' and 'password' required
Example: node createFSUser.js --user nrpuser --password password`
  );
  return;
}

let token = uuid();
//we want to check if the user already exists to avoid inserting a duplicate
DB.instance.users.find({ user: argv.user }).then(res => {
  if (!res.length) {
    DB.instance.users
      .insert({ user: argv.user, password: argv.password, token: token })
      .then(() => console.log(`New user '${argv.user}' created`))
      .catch(err => console.error('Failed to create new user:', err));
  } else {
    console.log(`User '${argv.user}' already exists, skipping insertion`);
  }
});
