'use strict';

const chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path');

chai.use(chaiAsPromised);

let StorageRequestHandler = require('../../storage/requestHandler.js');
let confFilePath = path.join(__dirname, '../utils/config.json'),
  configurationManager = rewire('../../utils/configurationManager.js');
configurationManager.__set__('CONFIG_FILE', confFilePath);
let confMock = configurationManager.loadConfigFile();

describe('Storage request handler', () => {
  it('should throw when the config file does not contain the storage attribute ', () => {
    let storageRequestHandler;
    confMock.storage = '';
    storageRequestHandler = new StorageRequestHandler(confMock);
    return expect(() => {
      return storageRequestHandler;
    }).to.be.an('Function');
  });
});
