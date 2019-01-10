'use strict';

const chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path'),
  sinon = require('sinon');
chai.use(chaiAsPromised);

describe('Configuration Manager', () => {
  let rewiredManager;

  beforeEach(() => {
    let confFile = path.join(__dirname, 'config.json');
    rewiredManager = rewire('../../utils/configurationManager');
    rewiredManager.__set__({ CONFIG_FILE: confFile });
  });

  it('should load the config file', () => {
    return expect(rewiredManager.default.loadConfigFile()).to.be.an('object');
  });

  it('should throw when the conf file is wrong', () => {
    var errorSpy = sinon.spy();
    var logSpy = sinon.spy();
    let wrongConfFile = path.join(__dirname, 'wrongConfig.json');
    let RewiredConf = rewire('../../utils/configurationManager');
    RewiredConf.__set__({ CONFIG_FILE: wrongConfFile });
    RewiredConf.__set__({
      console: {
        log: logSpy,
        error: errorSpy
      }
    });
    RewiredConf.default.loadConfigFile();
    sinon.assert.calledOnce(errorSpy);
  });

  it('should check the onConfigChange function when we are not passing a valid change state', () => {
    var errorSpy = sinon.spy();
    var logSpy = sinon.spy();
    let onChange = rewiredManager.__get__('onConfigChange');
    rewiredManager.__set__({
      console: {
        log: logSpy,
        error: errorSpy
      }
    });
    onChange('deleted');
    sinon.assert.calledOnce(logSpy);
  });

  it('should check the onConfigChange function when we are passing a valid change state', () => {
    var errorSpy = sinon.spy();
    var logSpy = sinon.spy();
    let onChange = rewiredManager.__get__('onConfigChange');
    rewiredManager.__set__({
      console: {
        log: logSpy,
        error: errorSpy
      }
    });
    onChange('change');
    sinon.assert.calledOnce(logSpy);
  });
});
