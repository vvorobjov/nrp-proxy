'use strict';

var request = require('request');
var q = require('q');

var CREATE_TOKEN_URL = '/token';
var authConfig;
var lastRenewalTime = 0;
var lastRetrievedToken;

var configure = function (newAuthConfig) {
  authConfig = newAuthConfig;
};

var getToken = function () {
  if (authConfig.deactivate)
    return q(false);

  if (lastRetrievedToken && Date.now() - lastRenewalTime < authConfig.renewInternal) {
    //the token is still valid (= under renewal interval)
    return q(lastRetrievedToken);
  }

  console.log('About to renew OIDC token...');
  var options = {
    method: 'post',
    form: {
      'grant_type': 'client_credentials',
      'client_id': authConfig.clientId,
      'client_secret': authConfig.clientSecret
    },
    url: authConfig.url + CREATE_TOKEN_URL,
  };

  var deferred = q.defer();

  lastRetrievedToken = null;
  request(options, function (err, res, body) {
    if (err) {
      deferred.reject(new Error(err));
    } else if (res.statusCode < 200 || res.statusCode >= 300) {
      deferred.reject(new Error('Status code: ' + res.statusCode + '\n' + body));
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
  getToken: function () {
    return getToken();
  },
  configure: configure
};