'use strict';

const fs = require('fs'),
    chai = require('chai'),
    chaiAsPromised = require('chai-as-promised'),
    rewire = require('rewire'),
    expect = chai.expect,
    should = chai.should(),
    path = require('path'),
    assert = chai.assert,
    sinon = require('sinon'),
    q = require('q');
chai.use(chaiAsPromised);

describe('Configuration Manager', () => {
    let rewiredManager = rewire('../../utils/configurationManager.js');

    beforeEach(() => {
        let confFile = path.join(__dirname, 'config.json');
        rewiredManager = rewire('../../utils/configurationManager.js');
        rewiredManager.__set__({ 'CONFIG_FILE': confFile });
    });

    it('should load the config file', () => {
        return expect(rewiredManager.loadConfigFile()).to.be.an('object');
    });

    it('should throw when the conf file is wrong', () => {
        var errorSpy = sinon.spy();
        var logSpy = sinon.spy();
        let RewiredConf;
        let wrongConfFile = path.join(__dirname, 'wrongConfig.json');
        RewiredConf = rewire('../../utils/configurationManager.js');
        RewiredConf.__set__({ 'CONFIG_FILE': wrongConfFile });
        RewiredConf.__set__({
            console: {
                log: logSpy,
                error: errorSpy
            }
        });
        RewiredConf.loadConfigFile();
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
