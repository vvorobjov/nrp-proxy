'use strict';

const fs = require('fs'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  q = require('q'),
  expect = chai.expect,
  should = chai.should();

const modelsPath = 'test/modelsData',
  expectedModelsFileName = `${modelsPath}/expectedResponses.json`,
  numberOfBrains = 3,
  models = ['robots', 'environments', 'brains'];


let expectedModelsParseResult = JSON.parse(fs.readFileSync(expectedModelsFileName, 'utf8'));

chai.use(chaiAsPromised);

describe('ModelsService', () => {
  let ModelsService = require('../../proxy/modelsService.js'),
    modelsService = new ModelsService(modelsPath);
  modelsService.loadModels();

  models.forEach(model => {
    it(`should load ${model} models correctly`, () => {
      return modelsService.getModels(model).should.deep.eventually.equal(expectedModelsParseResult[model]);
    });
  });

  it(`should return error when loading incorrect model`, () => {
    return modelsService.getModels('wrong_model').should.rejectedWith('Model wrong_model not found');
  });
});

describe('ModelsService errors', () => {
  let ModelsService;
  let consoleMock = { error: sinon.spy() };

  beforeEach(() => {
    ModelsService = rewire('../../proxy/modelsService.js');
    ModelsService.__set__('console', consoleMock);
    consoleMock.error.reset();
  });

  it(`should log to console if failure to find files`, () => {
    ModelsService.__set__('glob', q.reject());

    let modelsService = new ModelsService(modelsPath);
    return modelsService.loadModels()
      .then(() => sinon.assert.callCount(consoleMock.error, models.length));
  });

  it(`should log to console if failure to parse brain file`, () => {
    let BrainsModelLoader = ModelsService.__get__('BrainsModelLoader');
    class BrainsModelLoaderMock extends BrainsModelLoader {
      parseFileContent(file) { return q.reject(); }
    }

    let brainLoader = new BrainsModelLoaderMock();
    return brainLoader.loadModels(modelsPath)
      .then(() => sinon.assert.callCount(consoleMock.error, numberOfBrains));
  });
});

describe('ModelLoader errors', () => {
  let ModelsService = rewire('../../proxy/modelsService.js'),
    ModelLoader = ModelsService.__get__('ModelLoader');

  it(`should throw error on unimplemented methods`, () => {
    let modelLoader = new ModelLoader(),
      notImplementedException = 'Not implemented';

    expect(() => modelLoader.modelType).to.throw(notImplementedException);
    expect(() => modelLoader.filePattern).to.throw(notImplementedException);
    expect(modelLoader.parseFile).to.throw(notImplementedException);
  });

});