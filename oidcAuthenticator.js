'use strict';

var request = require('request');
var q = require('q');

var CREATE_TOKEN_URL = '/token';

var getToken = function (baseUrl, clientId, clientSecret) {

  var options = {
    method: 'post',
    form: {
      'grant_type': 'client_credentials',
      'client_id': clientId,
      'client_secret': clientSecret
    },
    url: baseUrl + CREATE_TOKEN_URL,
  };

  var deferred = q.defer();

  request(options, function (err, res, body) {
    if (err) {
      deferred.reject(new Error(err));
    } else if (res.statusCode < 200 || res.statusCode >= 300) {
      deferred.reject(new Error('Status code: ' + res.statusCode + '\n' + body));
    } else {
      try {
        var accessToken = JSON.parse(body)['access_token'];
        deferred.resolve(accessToken);
      } catch (e) {
        deferred.reject(new Error(body));
      }
    }
  });
  return deferred.promise;
};

module.exports = function (baseUrl) {
  return {
    getToken: function (clientId, clientSecret) {
      return getToken(baseUrl, clientId, clientSecret);
    }
  };
};