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

const fs = require('fs'),
  q = require('q'),
  _ = require('lodash'),
  stringify = q.denodeify(require('csv-stringify')),
  appendFile = q.denodeify(fs.appendFile);

// mocked in tests
// tslint:disable-next-line: prefer-const
let firebase = require('firebase-admin');

export default class ActivityLogger {
  private db?;
  private localfile?;

  constructor(private config) {
    if (config) {
      this.localfile = config.localfile;
    }
    if (config.databaseURL) {
      this.initializeFirebase();
    }
  }

  initializeFirebase() {
    const serviceAccount = require('./serviceAccount.json');
    firebase.initializeApp({
      credential: firebase.credential.cert(serviceAccount),
      databaseURL: this.config.databaseURL
    });
    this.db = firebase.firestore();
    this.db.settings({ timestampsInSnapshots: true });
  }

  async logLocal(activity, data) {
    const logContent = await stringify([
      [activity, new Date().toUTCString(), ..._.map(data)]
    ]);
    await appendFile(this.localfile, logContent);
  }

  async logFirebase(activity, data) {
    const activityLogsCollection = this.db.collection('activity-logs');
    // Add the activity entry in the Firestore database
    const doc = activityLogsCollection.doc();
    return doc.set({
      activity,
      date: new Date(),
      ...data
    });
  }

  async log(activity, data) {
    if (!this.config) return q.reject(`No activity logs enabled.`);

    if (this.localfile)
      // logs activity as text into a local CSV file
      await this.logLocal(activity, data);
    if (this.db)
      // logs activity object as an entry in a Firebase database
      await this.logFirebase(activity, data);

    return q.resolve();
  }
}
