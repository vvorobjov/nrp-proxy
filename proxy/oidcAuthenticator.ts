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

const axios = require('axios');
const q = require('q');
// workaround for https://github.com/nodejs/help/issues/1730
require('tls').DEFAULT_ECDH_CURVE = 'auto';

const CREATE_TOKEN_URL = '/protocol/openid-connect/token';
const USERINFO_ENDPOINT = '/protocol/openid-connect/userinfo';
const INTROSPECT_TOKEN_URL = '/protocol/openid-connect/token/introspect';
let authConfig;
let lastRenewalTime = 0;
let lastRetrievedToken;

const configure = newAuthConfig => {
  authConfig = newAuthConfig;
};

const getAuthConfig = () => {
  return authConfig;
};

const getUserinfoEndpoint = () => {
  return authConfig.url + USERINFO_ENDPOINT;
};

const getToken = () => {
  if (authConfig.deactivate) return q(false);

  if (
    lastRetrievedToken &&
    Date.now() - lastRenewalTime < authConfig.renewInternal
  ) {
    // the token is still valid (= under renewal interval)
    return q(lastRetrievedToken);
  }

  console.log('About to renew OIDC token...');
  const url = authConfig.url + CREATE_TOKEN_URL;
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: authConfig.clientId,
    client_secret: authConfig.clientSecret
  });
  console.log(url);

  const deferred = q.defer();

  lastRetrievedToken = null;
  axios({
    method: 'post',
    url,
    data: form,
    // keep the raw response string; the body is parsed explicitly below
    transformResponse: [body => body]
  })
    .then(res => {
      try {
        lastRetrievedToken = JSON.parse(res.data).access_token;
        lastRenewalTime = Date.now();
        deferred.resolve(lastRetrievedToken);
      } catch (e) {
        deferred.reject(new Error(res.data));
      }
    })
    .catch(err => {
      if (err.response) {
        deferred.reject(
          new Error(
            'Status code: ' + err.response.status + '\n' + err.response.data
          )
        );
      } else {
        deferred.reject(new Error(err.message));
      }
    });
  return deferred.promise;
};

const introspectToken = token => {
  if (authConfig.deactivate) return q(false);

  const url = authConfig.url + INTROSPECT_TOKEN_URL;
  const form = new URLSearchParams({
    token,
    client_id: authConfig.clientId,
    client_secret: authConfig.clientSecret
  });

  const deferred = q.defer();

  axios({
    method: 'post',
    url,
    data: form,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    // keep the raw response string; the body is parsed explicitly below
    transformResponse: [body => body]
  })
    .then(res => {
      try {
        const response = JSON.parse(res.data);
        deferred.resolve(response);
      } catch (e) {
        deferred.reject(new Error(res.data));
      }
    })
    .catch(err => {
      if (err.response) {
        deferred.reject(
          new Error(
            'Status code: ' + err.response.status + '\n' + err.response.data
          )
        );
      } else {
        deferred.reject(new Error(err.message));
      }
    });
  return deferred.promise;
};

export default {
  getToken,
  introspectToken,
  configure,
  getAuthConfig,
  getUserinfoEndpoint
};
