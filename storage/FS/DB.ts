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

import fs from 'fs';
import path from 'path';
import Tingodb from 'tingodb';

const tingodb = Tingodb();

// test mocked
// tslint:disable: prefer-const variable-name
let utils = require('./utils').default,
  DBCollection = require('./Collection').default;
// tslint:enable: prefer-const variable-name

// wraps tingo db
export default class DB {
  private static readonly DB_FOLDER = 'FS_db';
  private static _instance: DB;
  public readonly users;
  public readonly experiments;
  public readonly models;
  public readonly gdpr;

  // lazy instantiation to allow for unit test pre-mocking
  public static get instance() {
    if (!this._instance) this._instance = new DB();
    return this._instance;
  }

  constructor() {
    const dbDirectory = path.join(utils.storagePath, DB.DB_FOLDER);

    fs.existsSync(dbDirectory) || fs.mkdirSync(dbDirectory);

    const db = new tingodb.Db(dbDirectory, {});
    this.users = new DBCollection(db.collection('users'));
    this.experiments = new DBCollection(db.collection('experiments'));
    this.models = new DBCollection(db.collection('models'));
    this.gdpr = new DBCollection(db.collection('gdpr'));
  }
}
