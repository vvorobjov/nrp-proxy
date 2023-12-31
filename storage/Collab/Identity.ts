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

import BaseIdentity from '../BaseIdentity';
import CollabConnector from './CollabConnector';

const oidcAuthenticator = require('../../proxy/oidcAuthenticator').default;

export class Identity extends BaseIdentity {
  usersList: any[] = [];

  getUniqueIdentifier(token) {
    return this.getUserInfo('me', token).then(({ id }) => id);
  }

  async getUserInfo(userId, token) {
    // remap from collab 2 api to old one
    const response: any = await CollabConnector.instance.getHTTPS(
      oidcAuthenticator.getUserinfoEndpoint(),
      token,
      undefined
    );

    const userInfo = JSON.parse(response.body, function(key, value) {
      if (key === 'name') {
        this.displayName = value;
      } else if (key === 'preferred_username') {
        this.username = value;
        this.id = value;
      } else return value;
    });
    if (userId !== userInfo.id && userId !== 'me') return {};
    else return userInfo;
  }

  async getUserGroups(token) {
    const response: any = await CollabConnector.instance.getHTTPS(
      oidcAuthenticator.getUserinfoEndpoint(),
      token,
      undefined
    );
    const json = JSON.parse(response.body);
    return json.roles && json.roles.group;
  }

  // instead of returning a list of all users,
  // this function returns a list of a single user, which is active
  // that's a patch for Collab 2, which doesn't allow to get a full list
  async getUsersList(token) {
    if (this.usersList.length === 0) {
      const res = await this.getUserInfo('me', token);
      // const totalPages = 1;
      this.usersList.push({
        displayName: res.displayName,
        id: res.id,
        username: res.username
      });
    }

    return this.usersList;
  }
}
