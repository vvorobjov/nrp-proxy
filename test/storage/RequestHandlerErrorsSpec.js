'use strict';

const chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path');

chai.use(chaiAsPromised);

let {
  default: StorageRequestHandler
} = require('../../storage/requestHandler');
let confFilePath = path.join(__dirname, '../utils/config.json'),
  confFilePath2 = path.join(__dirname, '../utils/config_2.json'),
  configurationManagerRewire = rewire('../../utils/configurationManager'),
  configurationManager = configurationManagerRewire.default;
configurationManagerRewire.__set__('CONFIG_FILE', confFilePath);

let confMock = configurationManager.loadConfigFile();

configurationManagerRewire.__set__('CONFIG_FILE', confFilePath2);
let confMock2 = configurationManager.loadConfigFile();

describe('Storage request handler', () => {
  it('should throw when the config file does not contain the storage attribute ', () => {
    let storageRequestHandler;
    confMock.storage = '';
    storageRequestHandler = new StorageRequestHandler(confMock);
    return expect(() => {
      return storageRequestHandler;
    }).to.be.an('Function');
  });

  it('should throw when the config file does not contain the authorization attribute ', () => {
    let storageRequestHandler;
    confMock.storage = '';
    storageRequestHandler = new StorageRequestHandler(confMock2);
    return expect(() => {
      return storageRequestHandler;
    }).to.be.an('Function');
  });
});
