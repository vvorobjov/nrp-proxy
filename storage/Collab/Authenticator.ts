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
import oidcAuthenticator from '../../proxy/oidcAuthenticator';
import BaseAuthenticator from '../BaseAuthenticator';

// Clean the cache from the old tokens once an hour
const CACHE_CLEANUP_INTEVAL_MS = 1000 * 60 * 60;

export class Authenticator extends BaseAuthenticator {

  private authCache: Map<string, { time_ms: number; response: any }> = new Map();

  constructor(private config) {
    super();
    setTimeout(this.cleanCache.bind(this), CACHE_CLEANUP_INTEVAL_MS);
  }

  checkToken(token: string) {
    if (this.config.storage === 'Collab') {
      // No need to check token, it will be done by the underlying Collab storage requests
      return q.when(true);
    }

    // Do we have the token in cache?
    if (this.authCache.has(token)) {
      const cache = this.authCache.get(token);
      if (cache) {
        if (Date.now() < cache.time_ms) {
          // Cache still valid
          return q.when(cache.response);
        } else {
          console.debug('Token in cache is expired');
          this.authCache.delete(token);
        }
      }
    }

    // No valid cache, verify the token by trying to retrieve the user info
    return oidcAuthenticator.introspectToken(token).then(response => {
      const deferred = q.defer();
      // Check if the token is active
      if (response.active) {
        // Set token cache life time based on token expiration date
        this.authCache.set(token, { time_ms: response.exp * 1000, response });
        deferred.resolve(response);
      } else {
        deferred.reject(new Error('Token is not active.'));
      }
      return deferred.promise;
    });
  }

  /**
   * Removes expired entries from the authCache based on the current time.
   */
  cleanCache() {
    const currentTimeMS = Date.now();
    this.authCache.forEach((cache, key) => {
      if (currentTimeMS >= cache.time_ms) {
        this.authCache.delete(key);
      }
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
