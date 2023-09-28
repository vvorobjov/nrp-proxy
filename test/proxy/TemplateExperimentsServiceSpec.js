'use strict';

const chai = require('chai');
const rewire = require('rewire');
const sinon = require('sinon');
const path = require('path');
const expect = chai.expect;
const nock = require('nock');

const templatesPath = {
  Collab: 'test-nrp-access',
  FS: '$HBP/nrp-core/examples/templates'
};
const storagePath = '/test/data/nrpStorage';

let confFilePath = path.join(__dirname, '../utils/config.json');
let configurationManagerRewire = rewire('../../utils/configurationManager');
let configurationManager = configurationManagerRewire.default;
configurationManagerRewire.__set__('CONFIG_FILE', confFilePath);
let confMock = configurationManager.loadConfigFile();
confMock.templatesPath = templatesPath;

let TemplateExperimentsService = rewire(
  '../../proxy/TemplateExperimentsService'
);

let StorageRequestHandler = rewire('../mocks/StorageRequestHandler.js');
const mockUtils = { storagePath: storagePath };

const mockExperimentFiles = [
  '/path/to/experiment1.json',
  '/path/to/experiment2.json'
];
let globStub = sinon.stub().returns(Promise.resolve(mockExperimentFiles));

TemplateExperimentsService.__set__('utils', mockUtils);
TemplateExperimentsService.__set__('glob', globStub);
TemplateExperimentsService.__set__(
  'StorageRequestHandler',
  StorageRequestHandler
);

let templateES = new TemplateExperimentsService.default(confMock);

describe('TemplateExperimentsService', () => {
  describe('should construct an instance with the correct path', () => {
    it('in FS mode', () => {
      return expect(templateES.templatesFSPath).to.contain(templatesPath.FS);
    });

    it('in Collab authentication mode with proper wiki URL in templatesPath', () => {
      let confMockCollab = confMock;
      const templatesPathURL = 'https://wiki.ebrains.eu/test/collab';
      confMockCollab.templatesPath.Collab = templatesPathURL;
      confMockCollab.authentication = 'Collab';
      let templateESCollab = new TemplateExperimentsService.default(
        confMockCollab
      );
      return expect(templateESCollab.templatesCollabPath).to.equal(
        templatesPathURL
      );
    });

    it('in Collab authentication mode with proper wiki-int URL in templatesPath', () => {
      let confMockCollab = confMock;
      const templatesPathURL = 'https://wiki-int.ebrains.eu/test/collab';
      confMockCollab.templatesPath.Collab = templatesPathURL;
      confMockCollab.authentication = 'Collab';
      let templateESCollab = new TemplateExperimentsService.default(
        confMockCollab
      );
      return expect(templateESCollab.templatesCollabPath).to.equal(
        templatesPathURL
      );
    });

    it('in Collab authentication mode', () => {
      let confMockCollab = confMock;
      confMockCollab.templatesPath = templatesPath;
      confMockCollab.authentication = 'Collab';
      let templateESCollab = new TemplateExperimentsService.default(
        confMockCollab
      );
      return expect(templateESCollab.templatesCollabPath).to.equal(
        templatesPath.Collab
      );
    });
  });

  it('should get the shared experiment path properly', () => {
    var expectedResult = storagePath + '/experimentPath/experimentFile';
    var sharedExperimentPath = templateES.getSharedExperimentFilePath(
      'experimentPath',
      'experimentFile'
    );
    return expect(sharedExperimentPath).to.equal(expectedResult);
  });

  it('should get the experiment path properly', () => {
    var expectedResult = templatesPath.FS + '/experimentPath/experimentFile';
    var experimentPath = templateES.getExperimentFilePath(
      'experimentPath',
      'experimentFile'
    );
    return expect(experimentPath).to.equal(expectedResult);
  });

  describe('getExperiments', () => {
    const experiments = ['experiment1', 'experiment2'];
    let loadExperimentsStub;

    beforeEach(function() {
      loadExperimentsStub = sinon.stub(templateES, 'loadExperiments');
      loadExperimentsStub.returns(Promise.resolve(experiments));
    });

    afterEach(function() {
      loadExperimentsStub.restore();
    });

    it('should call loadExperiments when experiments === null', async () => {
      return templateES.getExperiments('token').then(exp => {
        expect(loadExperimentsStub.called).to.be.true;
        expect(exp).to.equal(experiments);
      });
    });

    it('should not call loadExperiments when experiments !== null', async () => {
      return templateES.getExperiments('token').then(exp => {
        expect(loadExperimentsStub.called).to.be.false;
        expect(exp).to.equal(experiments);
      });
    });
  });

  describe('loadExperiments', () => {
    let loadExperimentsLocalFilesystemStub;
    let loadExperimentsCollabStub;
    let templateESModified = templateES;
    const experiments = ['experiment1', 'experiment2'];

    beforeEach(() => {
      loadExperimentsLocalFilesystemStub = sinon.stub(
        templateESModified,
        'loadExperimentsLocalFilesystem'
      );
      loadExperimentsCollabStub = sinon.stub(
        templateESModified,
        'loadExperimentsCollab'
      );
    });

    afterEach(() => {
      loadExperimentsLocalFilesystemStub.restore();
      loadExperimentsCollabStub.restore();
    });

    it('should call loadExperimentsLocalFilesystem when useCollabTemplates is false', async () => {
      loadExperimentsLocalFilesystemStub.returns(Promise.resolve(experiments));
      templateESModified.config.authentication = 'FS';

      const result = await templateESModified.loadExperiments('token');

      expect(loadExperimentsLocalFilesystemStub.called).to.be.true;
      expect(loadExperimentsCollabStub.called).to.be.false;
      expect(result).to.deep.equal(experiments);
    });

    it('should call loadExperimentsCollab when config storage and authentication are set to Collab', async () => {
      loadExperimentsCollabStub.returns(Promise.resolve(experiments));
      templateESModified.config.authentication = 'Collab';
      templateESModified.templatesCollabPath = 'test-collab-loader';
      templateESModified.templatesFSPath = '';

      const result = await templateESModified.loadExperiments('token');

      expect(loadExperimentsLocalFilesystemStub.called).to.be.false;
      expect(loadExperimentsCollabStub.called).to.be.true;
      expect(result).to.deep.equal(experiments);
    });

    it('should load both local and collab experiments when config storage is FS and authentication is Collab', async () => {
      loadExperimentsCollabStub.returns(Promise.resolve(experiments));
      loadExperimentsLocalFilesystemStub.returns(Promise.resolve([]));
      templateESModified.config.authentication = 'Collab';
      templateESModified.templatesCollabPath = 'test-collab-loader';
      templateESModified.templatesFSPath = 'test-fs-loader';

      const result = await templateESModified.loadExperiments('token');

      expect(loadExperimentsLocalFilesystemStub.called).to.be.true;
      expect(loadExperimentsCollabStub.called).to.be.true;
      expect(result).to.deep.equal(experiments);
    });
  });

  it('loadExperimentsLocalFilesystem should properly load the files', async () => {
    let buildExperimentStub = sinon
      .stub(templateES, 'buildExperiment')
      .returns(Promise.resolve('built experiment'));

    const result = await templateES.loadExperimentsLocalFilesystem();
    expect(globStub.calledWith(path.join(templatesPath.FS, '*/*.json'))).to.be
      .true;

    expect(buildExperimentStub.callCount).to.equal(mockExperimentFiles.length);
    expect(result).to.deep.equal(['built experiment', 'built experiment']);

    buildExperimentStub.restore();
  });

  describe('getJsonProperty', () => {
    it('should return the property if it exists', () => {
      let prop = 'propValue';
      expect(templateES.getJsonProperty(prop)).to.equal('propValue');
    });

    it('should return the namespaced property if it exists', () => {
      let prop = { __text: 'namespacedValue' };
      expect(templateES.getJsonProperty(prop)).to.equal('namespacedValue');
    });

    it('should return the default value if the property does not exist and default value is provided', () => {
      let prop;
      let defaultValue = 'defaultValue';
      expect(templateES.getJsonProperty(prop, defaultValue)).to.equal(
        'defaultValue'
      );
    });

    it('should return undefined if the property does not exist and no default value is provided', () => {
      let prop;
      expect(templateES.getJsonProperty(prop)).to.be.undefined;
    });
  });

  it('loadExperimentsCollab should load the configs from Collab', async () => {
    const collabConfig = {
      experiments: [
        {
          path: 'experiment1'
        },
        {
          path: 'experiment2'
        }
      ]
    };

    let confMockCollab = confMock;
    const templatesPathURL = {
      Collab: 'https://wiki-int.ebrains.eu/test/collabTest'
    };
    confMockCollab.templatesPath = templatesPathURL;
    confMockCollab.authentication = 'Collab';
    let templateESCollab = new TemplateExperimentsService.default(
      confMockCollab
    );

    let getBucketNrpExperimentsConfigStub = sinon
      .stub(templateESCollab.collabStorage, 'getBucketNrpExperimentsConfig')
      .returns(Promise.resolve(collabConfig));
    let getExperimentConfigFilesStub = sinon
      .stub(templateESCollab.collabStorage, 'getExperimentConfigFiles')
      .returns(Promise.resolve(mockExperimentFiles));
    let buildExperimentStub = sinon
      .stub(templateESCollab, 'buildExperiment')
      .returns(Promise.resolve('built experiment'));

    await templateESCollab.loadExperimentsCollab('token');

    expect(getBucketNrpExperimentsConfigStub.calledWith('collabTest', 'token'))
      .to.be.true;
    expect(
      getExperimentConfigFilesStub.calledWith(
        'collabTest',
        'experiment1',
        'token'
      )
    ).to.be.true;
    expect(
      getExperimentConfigFilesStub.calledWith(
        'collabTest',
        'experiment2',
        'token'
      )
    ).to.be.true;
    expect(buildExperimentStub.callCount).to.equal(4);

    buildExperimentStub.restore();
  });

  it('should build experiment info from a given config file (FS)', async () => {
    let experimentConfigFileJSON = JSON.stringify({});
    let mockReadFile = sinon
      .stub()
      .returns(Promise.resolve(experimentConfigFileJSON));
    let revertReadFile = TemplateExperimentsService.__set__(
      'readFile',
      mockReadFile
    );

    const mockFileName = 'mockFileName';
    const mockExperimentName = 'mockExperimentName';
    const mockToken = 'mockToken';
    await templateES.buildExperiment(
      mockFileName,
      mockExperimentName,
      false,
      false,
      mockToken
    );
    await templateES.buildExperiment(
      mockFileName,
      mockExperimentName,
      true,
      false,
      mockToken
    );

    expect(mockReadFile.calledWith(mockFileName, 'utf8')).equals(true);

    revertReadFile();
  });

  it('should build experiment info from a given config file (Collab)', async () => {
    let experimentConfigFileJSON = JSON.stringify({});
    let spyGetFile = sinon
      .stub(templateES.collabStorage, 'getFile')
      .returns(Promise.resolve(experimentConfigFileJSON));

    const mockFileName = 'mockFileName';
    const mockExperimentName = 'mockExperimentName';
    const mockToken = 'mockToken';
    await templateES.buildExperiment(
      mockFileName,
      mockExperimentName,
      false,
      true,
      mockToken
    );

    expect(spyGetFile.calledWith(mockFileName, undefined, mockToken)).equals(
      true
    );

    spyGetFile.restore();
  });

  it('should catch errors while building experiment info', async () => {
    let mockReadFile = sinon.stub().throws('mock error');
    let revertReadFile = TemplateExperimentsService.__set__(
      'readFile',
      mockReadFile
    );
    let errorSpy = sinon.stub();
    let revertConsole = TemplateExperimentsService.__set__({
      console: { error: errorSpy, log: sinon.spy(), info: sinon.spy() }
    });

    const mockFileName = 'mockFileName';
    const mockExperimentName = 'mockExperimentName';
    const mockToken = 'mockToken';
    let experiment = await templateES.buildExperiment(
      mockFileName,
      mockExperimentName,
      false,
      false,
      mockToken
    );
    //console.info(experiment);
    expect(errorSpy.called);
    expect(typeof experiment).equals('undefined');

    revertReadFile();
    revertConsole();
  });

  it.skip('should load shared experiments properly', () => {
    return templateES.loadSharedExperiments().then(experiments => {
      return expect(experiments[0]).to.deep.equal(expectedResult);
    });
  });

  it.skip('should load experiment 1 properly', () => {
    return templateES.loadExperiments().then(experiments => {
      return expect(experiments[1]).to.deep.equal(expectedExp1);
    });
  });

  it.skip('should load experiment 2 properly', () => {
    return templateES.loadExperiments().then(experiments => {
      return expect(experiments[2]).to.deep.equal(expectedExp2);
    });
  });

  it.skip('should load openAI_nest experiment properly', async () => {
    let templateESV4 = new TemplateExperimentsService.default(
      configFileV4,
      experimentsPaths
    );
    return templateESV4.loadExperiments().then(experiments => {
      return expect(experiments[0]).to.deep.equal(expectedExpOpenAI);
    });
  });
});
