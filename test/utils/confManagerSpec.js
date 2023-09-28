'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const rewire = require('rewire');
const expect = chai.expect;
const path = require('path');
const sinon = require('sinon');
chai.use(chaiAsPromised);

describe('Configuration Manager', () => {
  let rewiredManager;

  beforeEach(() => {
    const confFile = path.join(__dirname, 'config.json');
    rewiredManager = rewire('../../utils/configurationManager');
    rewiredManager.__set__('CONFIG_FILE', confFile);
  });

  it('should load the config file', () => {
    const result = rewiredManager.default.loadConfigFile();
    return expect(result).to.be.an('object');
  });

  it('should throw an error when mandatory parameters are missing in the config file', () => {
    const configPath = 'path/to/config.json';
    const configFileContent = JSON.stringify({ modelsPath: '/path/to/models' });
    const expectedErrorMessage =
      'templatesPath is missing from the config file';

    var readSpy = sinon.stub().returns(configFileContent);
    rewiredManager.__set__('fs', {
      readFileSync: readSpy
    });
    var errorSpy = sinon.spy();
    var logSpy = sinon.spy();
    rewiredManager.__set__({
      console: {
        log: logSpy,
        error: errorSpy
      }
    });

    expect(() =>
      rewiredManager.default.loadConfigFile(configPath)
    ).to.not.throw();
    sinon.assert.calledWith(errorSpy, expectedErrorMessage);
  });

  it('should set (and write) and get state in config', () => {
    var writeSpy = sinon.stub();
    rewiredManager.__set__('fs', {
      writeFileSync: writeSpy
    });

    rewiredManager.__set__('configFile', { states: { oldKey: 'oldValue' } });
    expect(rewiredManager.default.getState('oldKey')).to.be.equal('oldValue');
    rewiredManager.default.setState('oldKey', 'newValue');
    sinon.assert.calledWith(
      writeSpy,
      sinon.match.any,
      JSON.stringify({
        states: {
          oldKey: 'newValue'
        }
      })
    );
    expect(rewiredManager.default.getState('oldKey')).to.be.equal('newValue');

    rewiredManager.__set__('configFile', {});
    rewiredManager.default.setState('newKey', 'value');
    sinon.assert.calledWith(
      writeSpy,
      sinon.match.any,
      JSON.stringify({
        states: {
          newKey: 'value'
        }
      })
    );
    expect(rewiredManager.default.getState('newKey')).to.be.equal('value');
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

  it('should be able to retrieve config states', () => {
    let mockConfigFile = {
      states: {
        a: 'test-state-a'
      }
    };
    rewiredManager.__set__({ configFile: mockConfigFile });
    expect(rewiredManager.default.getState('a')).equals(
      mockConfigFile.states.a
    );
    expect(typeof rewiredManager.default.getState('b')).equals('undefined');
  });
});
