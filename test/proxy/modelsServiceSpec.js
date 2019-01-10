'use strict';

const fs = require('fs'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  q = require('q');

const modelsPath = 'test/data/models',
  expectedModelsFileName = `${modelsPath}/expectedResponses.json`,
  numberOfBrains = 3,
  models = ['robots', 'environments', 'brains'];

let expectedModelsParseResult = JSON.parse(
  fs.readFileSync(expectedModelsFileName, 'utf8')
);

chai.use(chaiAsPromised);

describe('ModelsService', () => {
  let { default: ModelsService } = require('../../proxy/modelsService'),
    modelsService = new ModelsService(modelsPath);
  modelsService.loadModels();

  models.forEach(model => {
    it(`should load ${model} models correctly`, () => {
      return modelsService
        .getModels(model)
        .should.deep.eventually.equal(expectedModelsParseResult[model]);
    });
  });

  it(`should return error when loading incorrect model`, () => {
    return modelsService
      .getModels('wrong_model')
      .should.rejectedWith('Model wrong_model not found');
  });

  it(`should calculate model config from models path and specific model path`, async () => {
    const robotconfig = await modelsService.getModelConfig(
      'robots',
      'lauron_model'
    );
    robotconfig.should.contain(
      '/test/data/models/robots/lauron_model/model.config'
    );
  });

  it(`should throw if model not found`, async () => {
    return modelsService
      .getModelConfig('robots', 'fake_model')
      .catch(res => res.should.equal('No robots named fake_model was found.'));
  });
});

describe('ModelsService errors', () => {
  let ModelsService;
  let consoleMock = { error: sinon.spy() };

  beforeEach(() => {
    ModelsService = rewire('../../proxy/modelsService');
    ModelsService.__set__('console', consoleMock);
    consoleMock.error.reset();
  });

  it(`should log to console if failure to find files`, () => {
    ModelsService.__set__('glob', q.reject());

    let modelsService = new ModelsService.default(modelsPath);
    return modelsService
      .loadModels()
      .then(() => sinon.assert.callCount(consoleMock.error, models.length));
  });

  it(`should log to console if failure to parse brain file`, () => {
    let BrainsModelLoader = ModelsService.__get__('BrainsModelLoader');
    class BrainsModelLoaderMock extends BrainsModelLoader {
      parseFileContent() {
        return q.reject();
      }
    }

    let brainLoader = new BrainsModelLoaderMock();
    return brainLoader
      .loadModels(modelsPath)
      .then(() => sinon.assert.callCount(consoleMock.error, numberOfBrains));
  });
});
