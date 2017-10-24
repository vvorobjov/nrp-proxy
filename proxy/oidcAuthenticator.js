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

var request = require('request');
var q = require('q');

var CREATE_TOKEN_URL = '/token';
var authConfig;
var lastRenewalTime = 0;
var lastRetrievedToken;

var configure = function(newAuthConfig) {
  authConfig = newAuthConfig;
};

var getToken = function() {
  if (authConfig.deactivate) return q(false);

  if (
    lastRetrievedToken &&
    Date.now() - lastRenewalTime < authConfig.renewInternal
  ) {
    //the token is still valid (= under renewal interval)
    return q(lastRetrievedToken);
  }

  console.log('About to renew OIDC token...');
  var options = {
    method: 'post',
    form: {
      grant_type: 'client_credentials',
      client_id: authConfig.clientId,
      client_secret: authConfig.clientSecret
    },
    url: authConfig.url + CREATE_TOKEN_URL
  };

  var deferred = q.defer();

  lastRetrievedToken = null;
  request(options, function(err, res, body) {
    if (err) {
      deferred.reject(new Error(err));
    } else if (res.statusCode < 200 || res.statusCode >= 300) {
      deferred.reject(
        new Error('Status code: ' + res.statusCode + '\n' + body)
      );
    } else {
      try {
        lastRetrievedToken = JSON.parse(body)['access_token'];
        lastRenewalTime = Date.now();
        deferred.resolve(lastRetrievedToken);
      } catch (e) {
        deferred.reject(new Error(body));
      }
    }
  });
  return deferred.promise;
};

module.exports = {
  getToken: function() {
    return getToken();
  },
  configure: configure
};
