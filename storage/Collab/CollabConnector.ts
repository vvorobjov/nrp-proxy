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
// import { FileType } from '../BaseStorage';

const q = require('q'),
  _ = require('lodash'),
  path = require('path'),
  https = require('https');

// mocked in the tests
// tslint:disable-next-line: prefer-const
let request = require('request-promise');

// wraps the collab connection
export default class CollabConnector {
  static get REQUEST_TIMEOUT() {
    return 30 * 1000;
  } // ms

  static get COLLAB_API_URL() {
    return 'https://wiki.ebrains.eu/rest/v1/collabs';
  }

  static get URL_BUCKET_API() {
    return 'https://data-proxy.ebrains.eu/api/v1/buckets';
  }

  static get instance() {
    return this._instance;
  }

  private static _instance = new CollabConnector();

  private _getMemoizedCollabs?;

  private _getMemoizedCollab?;

  handleError(err) {
    console.error(`[Collab error] ${err}`);
    const errType = Object.prototype.toString.call(err).slice(8, -1);

    if (errType === 'Object' && err.statusCode) {
      if (
        err.statusCode === 403 ||
        (err.statusCode === 401 &&
          (err.message.indexOf('OpenId response: token is not valid') >= 0 ||
            err.message.indexOf('invalid_token') >= 0))
      )
        return q.reject({
          code: 477,
          msg: JSON.stringify({
            mode: 'collab'
          })
        });
    } else if (errType === 'String') {
      err = `[Collab error] ${err}`;
    }
    return q.reject(err);
  }

  executeRequest(options, token) {
    _.extend(options, {
      resolveWithFullResponse: true,
      timeout: CollabConnector.REQUEST_TIMEOUT,
      headers: {
        Date: new Date().toUTCString()
      }
    });

    // console.info("Token : ", token);
    options.headers.Authorization = 'Bearer ' + token;
    // console.info(options);
    // console.info(options.url);

    return request(options)
      .then(res => {
        if (res.statusCode < 200 || res.statusCode >= 300)
          throw 'Status code: ' + res.statusCode;
        if (options.encoding === null)
          return { headers: res.headers, body: res.body };
        return res.body;
      })
      .catch(this.handleError);
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
              console.error(e);
              reject(e);
            });
        })
        .on('error', e => {
          console.error(e);
          reject(e);
        });

      request.on('error', e => {
        console.error(e);
      });
      request.end();
    });
  }

  post(url, data, token, jsonType = false) {
    console.info('depreciated post methods');
    const operation = () =>
      this.executeRequest(
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

  postHTTPS(url, data, token, jsonType = false) {
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

  get(url, token) {
    console.info('depreciated get methods');
    return this.executeRequest({ uri: url, method: 'GET' }, token);
  }

  async getHTTPS(url, token, options) {
    options = options ? options : {};
    _.extend(options, {
      method: 'GET'
    });
    return await this.requestHTTPS(url, options, token);
  }

  async deleteHTTPS(url, token, options) {
    options = options ? options : {};
    _.extend(options, {
      method: 'DOWN'
    });
    return await this.requestHTTPS(url, options, token);
  }

  async getJSON(url, token) {
    // console.info(['getJSON() - url', url]);
    try {
      const response: any = await this.getHTTPS(url, token, { headers: { Accept: 'application/json' }});
      // console.info(response);
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
      const downloadResponse: any = await this.getHTTPS(
        `${CollabConnector.URL_BUCKET_API}/${fileUUID}?inline=false&redirect=false`,
        token,
        undefined
      );
      const downloadUrl = JSON.parse(downloadResponse.body);
      // console.info(['getBucketFile() - downloadResponse.body', downloadUrl.url])
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
      // resolve(fileResponse.body);
    });
  }

  delete(url, token) {
    console.info('depreciated delete methods');
    return this.executeRequest(
      {
        method: 'DELETE',
        uri: url
      },
      token
    );
  }

  getCollabEntity(token, collabId) {
    if (!this._getMemoizedCollabs)
      this._getMemoizedCollabs = _.memoize(
        this.getEntity,
        (token, collabId) => collabId
      );
    return this._getMemoizedCollabs(token, collabId);
  }

  getEntity(token, collabId, ...entityPath) {
    if (!collabId) return q.reject('No collab id specified');

    const fullpath = encodeURIComponent(
      path.join('/', collabId + '', entityPath.join('/'))
    );
    const COLLAB_STORAGE_URL = `${CollabConnector.COLLAB_API_URL}/entity/?path=${fullpath}`;
    console.info('entity get');
    try {
      const response: any = this.getHTTPS(COLLAB_STORAGE_URL, token, undefined);
      return JSON.parse(response.body);
    } catch (error) {
      console.error(error);
    }
  }

  projectFolders(token, project) {
    return this.jsonApi(token, 'project', project, 'children').then(res =>
      res.results.map(f => ({
        uuid: f.uuid,
        name: f.name,
        parent: f.parent
      }))
    );
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
    console.info('creating ' + filepath);
    const BUCKET_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${filepath}/copy?to=${destination}&name=${name}`;

    return this.postHTTPS(
      BUCKET_FILE_URL,
      {
        name,
        filepath,
        content_type: contentType
      },
      token,
      true
    );
  }

  deleteEntity(token, folder, entityUuid, type = 'file') {
    const COLLAB_FILE_URL = `${CollabConnector.COLLAB_API_URL}/${type}/${entityUuid}/`;
    return this.deleteHTTPS(COLLAB_FILE_URL, token, undefined);
  }

  createFolder(token, parent, newExpName, experiment) {
    console.info('creating folder ', newExpName);
    const BUCKET_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${experiment}%2F/copy?to=${parent}&name=${newExpName}%2F`;

    return this.postHTTPS(
      BUCKET_FILE_URL,
      {
        newExpName,
        parent
      },
      token,
      true
    );
  }

  uploadContent(token, entityUuid, content) {
    const COLLAB_FILE_URL = `${CollabConnector.COLLAB_API_URL}/file/${entityUuid}/content/upload/`;

    return this.postHTTPS(COLLAB_FILE_URL, content, token).then(() => ({
      uuid: entityUuid
    }));
  }

  deleteBucketEntity(token, parent, entityUuid, type = 'file') {
    let COLLAB_FILE_URL;
    if (type === 'file') {
      COLLAB_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${parent}/${entityUuid}`;
    } else if (type === 'folder') {
      COLLAB_FILE_URL = `${CollabConnector.URL_BUCKET_API}/${entityUuid}/`;
      console.info(token);
    }

    return this.deleteHTTPS(COLLAB_FILE_URL, token, undefined);
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

  createBucketFolder(token, parent, name, experiment) {
    const BUCKET_FOLDER_URL = `${CollabConnector.URL_BUCKET_API}/${experiment}%2F/copy?to=${parent}&name=${name}%2F`;
    return this.postHTTPS(
      BUCKET_FOLDER_URL,
      {},
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

  // TODO: merge with getBucketFile
  entityContent(token, entityUuid) {
    console.info(['entityContent()', entityUuid]);
    const COLLAB_ENTITY_URL = `${CollabConnector.URL_BUCKET_API}/${entityUuid}`;
    // let downloadResponse : any = await this.getHTTPS(`${CollabConnector.URL_BUCKET_API}/${fileUUID}`, token);

    return this.getJSON(COLLAB_ENTITY_URL, token).then(jsonDownloadLink => {
      if (
        jsonDownloadLink &&
        jsonDownloadLink.headers &&
        jsonDownloadLink.headers.location
      ) {
        return this.executeRequest(
          {
            method: 'GET',
            uri: jsonDownloadLink.url,
            encoding: null
          },
          undefined
        );
      } else {
        return undefined;
      }
    });
  }

  async jsonApi(token, entityType, entityUuid, requestType) {
    try {
      const response: any = await this.api(token, entityType, entityUuid, requestType);
      return JSON.parse(response);
    } catch (error) {
      console.info(error);
    }
  }

  api(token, entityType, entityUuid, requestType) {
    const COLLAB_ENTITY_URL = `${CollabConnector.COLLAB_API_URL}/${entityType}/${entityUuid}/${requestType}/`;
    return this.getHTTPS(COLLAB_ENTITY_URL, token, undefined);
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
