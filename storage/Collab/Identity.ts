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

export class Identity extends BaseIdentity {
  usersList: any[] = [];

  static get IDENTITY_API_URL() {
    return 'https://services.humanbrainproject.eu/idm/v1/api';
  }

  getUniqueIdentifier(token) {
    return this.getUserInfo('me', token).then(({id}) => id);
  }

  getUserInfo(userId, token) {
    return CollabConnector.instance
      .get(`${Identity.IDENTITY_API_URL}/user/${userId}`, token)
      .then(res => JSON.parse(res));
  }

  getUserGroups(token) {
    return CollabConnector.instance
      .get(
        `${Identity.IDENTITY_API_URL}/user/me/member-groups?page=0&pageSize=1000`,
        token
      )
      .then(res => JSON.parse(res)._embedded.groups);
  }

  async getUsersList(token) {
    if (this.usersList.length === 0) {
      const res = await this.getUserListPage(token, 0);
      const totalPages = res.page.totalPages;
      this.usersList = this.usersList.concat(res._embedded.users.map(u => {
        return {
          displayName: u.displayName,
          id: u.id,
          username: u.username
        };
      }));

      const jobs: any[] = [];
      for (let i = 1; i < totalPages; i++) {
        jobs.push(this.getUserListPage(token, i));
      }

      const results = await Promise.all(jobs);
      for (const result of results) {
        this.usersList = this.usersList.concat(result._embedded.users.map(u => {
          return {
            displayName: u.displayName,
            id: u.id,
            username: u.username
          };
        }));
      }
    }

    return this.usersList;
  }

  getUserListPage(token, pageNumber) {
    return CollabConnector.instance
      .get(
        `${Identity.IDENTITY_API_URL}/user?page=${pageNumber}&pageSize=500`,
        token
      )
      .then(res => JSON.parse(res));
  }

}
