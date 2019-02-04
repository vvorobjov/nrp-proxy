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

import q from 'q';
import BaseIdentity from '../BaseIdentity';

// mocked on unit tests
// tslint:disable: prefer-const
let DB = require('./DB').default;
// tslint:enable: prefer-const

export class Identity extends BaseIdentity {
  constructor() {
    super();
  }

  getUniqueIdentifier(token) {
    return DB.instance.users
      .findOne({ token })
      .then(
        res =>
          res ||
          q.reject({ code: 404, msg: 'getUniqueIdentifier: user id not found' })
      )
      .then(res => res.user);
  }

  getUsersList() {
    return DB.instance.users
      .find({})
      .then(
        users =>
          users ||
          q.reject({ code: 404, msg: 'getUsersList: error getting the users' })
      )
      .then(users =>
        users.map(f => {
          return f.user;
        })
      );
  }

  getUserInfo(user, token) {
    let findCondition;
    if (user === 'me') {
      findCondition = { token };
    } else findCondition = { user };

    return DB.instance.users
      .findOne(findCondition)
      .then(
        res =>
          res || q.reject({ code: 404, msg: 'getUserInfo: user id not found' })
      )
      .then(res => ({
        id: res.user,
        displayName: res.user
      }));
  }

  getUserGroups(token, userId) {
    const groups = [{ name: 'hbp-sp10-user-edit-rights' }];
    if (userId === 'admin') groups.push({ name: 'hbp-sp10-administrators' });
    return q.when(groups);
  }
}
