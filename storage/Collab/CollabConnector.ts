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

import { URL } from 'url';
import configurationManager from '../../utils/configurationManager';
// import { FileType } from '../BaseStorage';

const q = require('q'),
  _ = require('lodash'),
  path = require('path'),
  https = require('https');

// mocked in the tests
// tslint:disable-next-line: prefer-const
let request = require('request-promise');

let config;

const SINGLETON_ENFORCER = Symbol();

// wraps the collab connection
export default class CollabConnector {

  static get REQUEST_TIMEOUT() {
    return 30 * 1000;
  } // ms

  static get URL_BUCKET_API() {
    if (config.bucketUrlApi) {
      return config.bucketUrlApi;
    } else {
      console.info('No bucket api url found in the configuration file, you may have an outdated configuration file');
      return '';
    }
  }

  static get SEARCH_TAG_URL() {
    if (config.searchTagUrl) {
      return config.searchTagUrl;
    } else {
      console.info('No search tag url found in the configuration file, you may have an outdated configuration file');
      return '';
    }
  }

  static get instance() {
    if (typeof this._instance === 'undefined') {
      this._instance = new CollabConnector(SINGLETON_ENFORCER);
    }

    return this._instance;
  }

  private static _instance;

  private _getMemoizedCollabs?;

  private _getMemoizedCollab?;

  constructor(enforcer) {
    if (enforcer !== SINGLETON_ENFORCER) {
      throw new Error('Use ' + this.constructor.name + '.instance');
    }

    config = configurationManager.loadConfigFile();
  }

  initConfig(configFilePath) {
    config = configurationManager.loadConfigFile(configFilePath);
  }

  requestHTTPS(url, options, authToken) {
    return new Promise((resolve, reject) => {
      const urlObject = new URL(url);
      _.extend(options, {
        hostname: urlObject.hostname,
        path: urlObject.pathname + urlObject.search,
        timeout: CollabConnector.REQUEST_TIMEOUT,
        resolveWithFullResponse: true
      });
      options.headers = options.headers ? options.headers : {};
      options.headers.Date = new Date().toUTCString();
      if (authToken) {
        options.headers.Authorization = 'Bearer ' + authToken;
      }
      let data = '';
      const request = https
        .request(options, response => {
          if (
            url.endsWith('.jpg') ||
            url.endsWith('.jpeg') ||
            url.endsWith('.png')
          ) {
            response.setEncoding('binary');
          }

          response
            .on('data', chunk => {
              data += chunk;
            })
            .on('end', () => {
              const json =  {headers: response.headers, body: data };
              resolve(json);
            })
            .on('error', e => {
              console.info('error on response');
              reject(e);
            });
        })
        .on('error', e => {
          console.info('error start request');
          reject(e);
        });
      request.on('error', e => {
        console.error(e);
      });
      request.end();
    });
  }

  postHTTPS(url, data, token, options, jsonType = false) {
    console.info('new post method : ', url);
    const operation = () =>
      this.requestHTTPS(url,
        {
          method: 'POST',
          uri: url,
          body: data,
          json: !!jsonType
        },
        token
      );

    return operation().catch(e => {
      if (e.message && e.message === 'Error: ESOCKETTIMEDOUT')
        return operation();
      throw e;
    });
  }

  async putHTTPS(url, data, token, options, jsonType = false) {
    console.info('new put method : ', url);
    options = options ? options : {};
    _.extend(options, {
      method: 'PUT',
      uri: url,
      body: data,
      json: !!jsonType
    });
    return  await this.requestHTTPS(url,
        options,
        token
      ).catch(e => {
        console.info(e);
        if (e.message && e.message === 'Error: ESOCKETTIMEDOUT')
          console.info('Error: ESOCKETTIMEDOUT');
        throw e;
      });
  }

  async getHTTPS(url, token, options) {
    options = options ? options : {};
    _.extend(options, {
      method: 'GET'
    });
    return await this.requestHTTPS(url, options, token);
  }

  async deleteHTTPS(url, token, options) {
    console.info('deleting exp : ', url);
    options = options ? options : {};
    _.extend(options, {
      method: 'DELETE'
    });
    return await this.requestHTTPS(url, options, token).then(response => {
      console.info(response);
      return response;
    });
  }

  async getJSON(url, token) {
    // console.info(['getJSON() - url', url]);
    try {
      const response: any = await this.getHTTPS(url, token, { headers: { Accept: 'application/json' }});
      // console.info(response);
      if (response.headers['content-type'].startsWith('application/xml;charset=UTF-8')) {
        // console.info(response);
        return JSON.parse(response.body);
      }
      if (response.headers['content-type'].startsWith('application/json')) {
        // console.info(response);
        return JSON.parse(response.body);
      } else {
        console.error(
          'CollabConnector.getJSON() - requested content is not of type JSON: ' +
            url
        );
        console.error(response);
        return undefined;
      }
    } catch (error) {
      console.error(error);
    }
  }

  async getBucketFile(fileUUID, token, options) {

    return new Promise(async (resolve, reject) => {
      try {
      const downloadResponse: any = await this.getHTTPS(
        `${CollabConnector.URL_BUCKET_API}/${fileUUID}?inline=false&redirect=false`,
        token,
        undefined
      );
      const downloadUrl = JSON.parse(downloadResponse.body);
      // console.info(['getBucketFile() - downloadResponse.body', downloadUrl.body]);
      const fileResponse: any = await this.getHTTPS(
        downloadUrl.url,
        undefined,
        options
      ); // passing auth token here leads to access denied ... ?
      // console.info(['getBucketFile() - fileResponse', fileResponse]);

      if (options && options.encoding === null) {
        resolve({ headers: fileResponse.headers, body: fileResponse.body });
      } else {
        resolve(fileResponse.body);
      }
      resolve(fileResponse.body);
      } catch (error) {
      reject(error);
    }});
  }

  createFile(token, parent, name, contentType) {
    console.info('creating ' + parent + '/' + name);
    const BUCKET_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${parent}/${name}/copy?to=${parent}&name=${name}`;

    return this.postHTTPS(
      BUCKET_FILE_URL,
      {
        name,
        parent,
        content_type: contentType
      },
      token,
      true
    );
  }

  copyFile(token, filepath, destination, name, contentType) {
    console.info('copying ' + filepath + name);
    const BUCKET_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${filepath}/copy?to=${destination}&name=${name}`;

    return this.putHTTPS(
      BUCKET_FILE_URL,
      {
        name,
        filepath,
        content_type: contentType
      },
      token,
      undefined,
      true
    );
  }

  copyFolder(token, parent, newExpName, experiment) {

    const BUCKET_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${experiment}%2F/copy?to=${parent}&name=${newExpName}%2F`;
    console.info('copying folder ', BUCKET_FILE_URL);
    return this.putHTTPS(
      BUCKET_FILE_URL,
      {
        newExpName,
        parent
      },
      token,
      undefined,
      true
    );
  }

  createFolder(token, parent, newExpName, experiment) {
    throw 'not implemented';
  }

  async uploadContent(token, entityUuid, content) {
    return 'not implemented';
    /* console.info('uploading : ', typeof(content));
    const COLLAB_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${entityUuid}`;

    return await this.putHTTPS(COLLAB_FILE_URL, undefined, token, {headers: { accept: 'application/json' }})
      .then((response: any) => {
        console.info(response);
        const uploadUrl = JSON.parse(response.body).url;
        this.putHTTPS(uploadUrl, content, undefined, undefined, true);
        return response;
      })
      .then(() => ({uuid : entityUuid}))
      .catch(error => console.error());
     */
  }

  async deleteBucketEntity(token, parent, entityUuid, type = 'file') {
    let COLLAB_FILE_URL;
    if (type === 'file') {
      COLLAB_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${parent}/${entityUuid}`;
    } else if (type === 'folder') {
      COLLAB_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${entityUuid}/`;
      console.info(token);
    }
    console.info(COLLAB_FILE_URL);
    return await this.deleteHTTPS(COLLAB_FILE_URL, token, undefined);
  }

  createBucketFile(token, parent, name, contentType) {
    const BUCKET_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${parent}/${name}/copy`;

    return this.postHTTPS(
      BUCKET_FILE_URL,
      {
        name,
        parent,
        content_type: contentType
      },
      token,
      true
    );
  }

  bucketFolderContent(token, folder) {
    // console.info("bucketFolderContent ", folder);
    let folderContent;
    const indexFirstSlash = folder.indexOf('/');
    let bucketName;
    let bucketFolderPath;
    if (indexFirstSlash !== -1) {
      bucketName = folder.substring(0, indexFirstSlash);
      bucketFolderPath = folder.substring(indexFirstSlash + 1);
    } else {
      bucketName = folder;
    }

    let urlBucketGET =
      CollabConnector.URL_BUCKET_API +
      '/' +
      bucketName +
      '?limit=9999&delimiter=%2F';
    if (typeof bucketFolderPath !== 'undefined') {
      urlBucketGET += '&prefix=' + bucketFolderPath + '/';
    }
    // console.info(['bucketFolderContent() - urlBucketGET:', urlBucketGET]);

    return this.getJSON(urlBucketGET, token).then(bucketContent => {

      folderContent =
        bucketContent &&
        bucketContent.objects &&
        bucketContent.objects.map(entry => {
          const objectFullPath = entry.name ? entry.name : entry.subdir;
          let filename = objectFullPath;
          if (bucketFolderPath) {
            filename = objectFullPath.replace(bucketFolderPath + '/', '');
          }
          if (filename.endsWith('/')) filename = filename.slice(0, -1);

          return {
            name: filename,
            uuid: folder + '/' + filename,
            parent: folder.replace(bucketName + '/', ''),
            type: entry.subdir ? 'folder' : 'file',
            contentType: entry.content_type,
            modifiedOn: entry.last_modified,
            size: entry.bytes
          };
        });
      // console.info(['bucketFolderContent() - folderContent', folderContent]);

      return folderContent;
    });
  }

  async getContextIdCollab(token, contextId) {
    console.info('checking memoized...');
    if (!this._getMemoizedCollab) {
      this._getMemoizedCollab = _.memoize(
        async (token, contextId) => {
          const COLLAB_URL = `https://services.humanbrainproject.eu/collab/v0/collab/context/${contextId}/`;
          const response: any = await this.getHTTPS(COLLAB_URL, token, undefined);
          return JSON.parse(response.body).collab.id;
        },
        (token, contextId) => token + contextId
      );
    }

    return this._getMemoizedCollab(token, contextId);
  }
}
