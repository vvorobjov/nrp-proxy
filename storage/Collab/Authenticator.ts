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

import BaseAuthenticator from '../BaseAuthenticator';
import { Identity } from './Identity';

const q = require('q'),
  path = require('path'),
  identity = new Identity();

export class Authenticator extends BaseAuthenticator {
  static get TOKEN_CACHE_DURATION_MS() {
    return 60 * 1000;
  }

  private authCache = new Map();

  constructor(private config) {
    super();
  }

  checkToken(token) {
    if (this.config.storage === 'Collab') {
      // No need to check token, it will be done by the underlying Collab storage requests
      return q.when(true);
    }

    // do we have the token in cache?
    if (this.authCache.has(token)) {
      const cache = this.authCache.get(token);
      if (Date.now() - cache.time <= Authenticator.TOKEN_CACHE_DURATION_MS) {
        // cache still time valid
        return q.when(cache.userinfo);
      } else this.authCache.delete(token);
    }
    // no valid cache, we verify the token by trying to retrieve the user info
    return identity.getUserInfo('me', token).then(userinfo => {
      this.authCache.set(token, { time: Date.now(), userinfo });
      return userinfo;
    });
  }

  login(usr, pwd) {
    throw 'not implemented';
  }

  getLoginPage() {
    console.info('getloginpage--------------------------------------------------------------------');
    throw 'not implemented';
  }
}
