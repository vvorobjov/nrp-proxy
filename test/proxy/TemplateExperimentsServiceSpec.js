'use strict';

const chai = require('chai'),
  rewire = require('rewire'),
  path = require('path'),
  expect = chai.expect;

const experimentsPaths = 'test/data/experiments';

let configFileV4 = {
  nrpVersion: '4.0.0',
  storage: 'FS',
  authentication: 'FS'
};

const expectedExp1 = {
  id: 'ExDTemplateHusky',
  name: 'Template Husky in empty environment',
  isShared: false,
  thumbnail: 'test.png',
  path: 'experiment1',
  tags: [],
  description:
    'This experiment loads the Husky robot in an empty world, with an idle brain and basic transfer functions. You are free to edit it.',
  experimentId: 'experiment1/ExDTemplateHusky.exc',
  maturity: 'production',
  timeout: 840,
  physicsEngine: 'ode',
  robotPaths: { test: 'robots/husky_model/model.config' },
  brainProcesses: 1,
  cameraPose: [4.5, 0, 1.8, 0, 0, 0.6],
  visualModel: undefined,
  visualModelParams: undefined
};

const expectedExp2 = {
  id: 'ExDNao',
  name: 'NAO experiment',
  isShared: false,
  thumbnail: 'ExDNao.jpg',
  path: 'experiment2',
  tags: [],
  description:
    'This experiment loads the humanoid robot NAO (Aldebaran) and the virtual room environment. In the future, it will be possible to connect NAO to a neuronal controller (NEST) to control single joints of the robot.',
  experimentId: 'experiment2/ExDNao.exc',
  maturity: 'development',
  timeout: 840,
  physicsEngine: 'ode',
  robotPaths: { test: 'husky_model/model.sdf' },
  brainProcesses: 1,
  cameraPose: [4.5, 0, 1.8, 0, 0, 0.6],
  visualModel: undefined,
  visualModelParams: undefined
};

const expectedExpOpenAI = {
  SimulationTimestep: 0.01,
  experimentId: 'openAI_nest_py/simulation_config.json',
  configFile: 'simulation_config.json',
  path: 'openAI_nest_py',
  thumbnail: '/',
  ComputationalGraph: undefined,
  ConnectMQTT: undefined,
  ConnectROS: undefined,
  SimulationLoop: 'FTILoop',
  SimulationName: 'test_openai_nest',
  SimulationDescription:
    'Launch a py_sim engine to run openAI simulation and a nest engine to control the simulation',
  SimulationTimeout: 10,
  DataPackProcessor: 'tf',
  EngineConfigs: [
    {
      EngineType: 'nest_json',
      EngineName: 'nest_controller',
      EngineTimestep: 0.01,
      NestInitFileName: 'nest_controller.py'
    },
    {
      EngineType: 'py_sim',
      EngineName: 'gym_simulator',
      PythonFileName: 'gym_simulator.py',
      WorldFileName: 'MountainCar-v0',
      Simulator: 'OpenAI',
      Visualizer: true
    }
  ],
  DataPackProcessingFunctions: [
    {
      Name: 'from_nest',
      FileName: 'from_nest.py'
    },
    {
      Name: 'from_gym',
      FileName: 'from_gym.py'
    }
  ],
  EventLoopTimeout: undefined,
  EventLoopTimestep: undefined,
  ExternalProcesses: undefined,
  ProcessLauncherType: 'Basic'
};

let confFilePath = path.join(__dirname, '../utils/config.json'),
  configurationManagerRewire = rewire('../../utils/configurationManager'),
  configurationManager = configurationManagerRewire.default;

configurationManagerRewire.__set__('CONFIG_FILE', confFilePath);

let confMock = configurationManager.loadConfigFile();
let ExperimentsService = rewire('../../proxy/TemplateExperimentsService');
/* initializing Mocks*/
var StorageRequestHandler = rewire('../mocks/StorageRequestHandler.js');

const mockUtils = { storagePath: 'test/data/sharedExperiments' };

ExperimentsService.__set__('utils', mockUtils);

ExperimentsService.__set__('StorageRequestHandler', StorageRequestHandler);
let experimentsService = new ExperimentsService.default(
  confMock,
  experimentsPaths
);

describe.skip('TemplateExperimentsService', () => {
  /* setting Mocks*/
  var expectedResult = {
    id: 'experiment1',
    name: 'Template Husky in empty environment',
    isShared: true,
    thumbnail: 'test.png',
    robotPaths: {
      test: 'robots/husky_model/model.config'
    },
    path: 'experiment1',
    physicsEngine: 'ode',
    tags: [],
    description:
      'This experiment loads the Husky robot in an empty world, with an idle brain and basic transfer functions. You are free to edit it.',
    experimentId: 'experiment1/ExDTemplateHusky.exc',
    maturity: 'production',
    timeout: 840,
    brainProcesses: 1,
    cameraPose: [4.5, 0, 1.8, 0, 0, 0.6],
    visualModel: undefined,
    visualModelParams: undefined
  };

  it('should get the shared experiment path properly', () => {
    var expectedResult =
      'test/data/sharedExperiments/experimentPath/experimentFile';
    var sharedExperimentPath = experimentsService.getSharedExperimentFilePath(
      'experimentPath',
      'experimentFile'
    );
    return expect(sharedExperimentPath.endsWith(expectedResult)).to.equal(true);
  });

  it('should get the experiment path properly', () => {
    var expectedResult = '/test/data/experiments/experimentPath/experimentFile';
    var experimentPath = experimentsService.getExperimentFilePath(
      'experimentPath',
      'experimentFile'
    );
    return expect(experimentPath.endsWith(expectedResult)).to.equal(true);
  });

  it('should load shared experiments properly', () => {
    return experimentsService.loadSharedExperiments().then(experiments => {
      return expect(experiments[0]).to.deep.equal(expectedResult);
    });
  });

  it('should test that the getExcProperty function parses .exc without namespaces', () => {
    const propertyWithoutNamespace = 'testProperty';
    let result = experimentsService.getExcProperty(propertyWithoutNamespace);
    return expect(result).to.equal(propertyWithoutNamespace);
  });

  it('should test that the getExcProperty function parses .exc with namespaces', () => {
    const propertyWithNamespace = { __text: 'testProperty' };
    let result = experimentsService.getExcProperty(propertyWithNamespace);
    return expect(result).to.equal(propertyWithNamespace.__text);
  });

  it('should test that the getExcProperty function returns undefined when an empty prop is passed', () => {
    const emptyProperty = undefined;
    let result = experimentsService.getExcProperty(emptyProperty);
    return expect(result).to.equal(undefined);
  });

  it('should test that the getExcProperty function returns the default value when an empty prop with default value is passed', () => {
    const emptyProperty = undefined;
    let result = experimentsService.getExcProperty(
      emptyProperty,
      'testDefaultValue'
    );
    return expect(result).to.equal('testDefaultValue');
  });

  it('should construct an experiments Service instance with the correct path', () => {
    return expect(experimentsService.experimentsPath).to.contain(
      experimentsPaths
    );
  });

  it('should load experiment 1 properly', () => {
    return experimentsService.loadExperiments().then(experiments => {
      return expect(experiments[1]).to.deep.equal(expectedExp1);
    });
  });

  it('should load experiment 2 properly', () => {
    return experimentsService.loadExperiments().then(experiments => {
      return expect(experiments[2]).to.deep.equal(expectedExp2);
    });
  });

  it('should load openAI_nest experiment properly', async () => {
    let experimentsServiceV4 = new ExperimentsService.default(
      configFileV4,
      experimentsPaths
    );
    return experimentsServiceV4.loadExperiments().then(experiments => {
      return expect(experiments[0]).to.deep.equal(expectedExpOpenAI);
    });
  });
});
