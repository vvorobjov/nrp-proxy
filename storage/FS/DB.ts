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

import utils_original from './utils';
import DBCollection_original from './Collection';

const fs = require('fs'),
  path = require('path'),
  tingodb = require('tingodb')();

//test mocked
let utils = utils_original,
  DBCollection = DBCollection_original;

//wraps tingo db
export default class DB {
  private static _instance?: DB;
  private _users;
  private _experiments;
  private _models;
  private _gdpr;

  static get DB_FOLDER() {
    return 'FS_db';
  }

  static get instance() {
    if (!this._instance) this._instance = new DB();
    return this._instance;
  }

  get users() {
    return this._users;
  }
  get experiments() {
    return this._experiments;
  }
  get models() {
    return this._models;
  }
  get gdpr() {
    return this._gdpr;
  }
  constructor() {
    this.loadDB(path.join(utils.storagePath, DB.DB_FOLDER));
  }

  loadDB(dbDirectory) {
    fs.existsSync(dbDirectory) || fs.mkdirSync(dbDirectory);

    let db = new tingodb.Db(dbDirectory, {});
    this._users = new DBCollection(db.collection('users'));
    this._experiments = new DBCollection(db.collection('experiments'));
    this._models = new DBCollection(db.collection('models'));
    this._gdpr = new DBCollection(db.collection('gdpr'));
  }
}
