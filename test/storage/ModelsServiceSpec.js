'use strict';
const fs = require('fs-extra'),
  chai = require('chai'),
  path = require('path'),
  expect = chai.expect,
  rewire = require('rewire'),
  q = require('q'),
  jszip = require('jszip');
chai.use(require('chai-as-promised'));

let ModelsService, modelsService;
let fakeJSZip = {
  loadAsync: () =>
    q.when({
      file: () => 'data'
    })
};
let fakeModel = {
  ownerId: 'userId',
  type: 'type',
  path: 'config',
  isShared: false,
  isCustom: true
};

ModelsService = rewire('../../storage/ModelsService');
ModelsService.__set__('jszip', fakeJSZip);
modelsService = new ModelsService.default();

describe('CustomModelsService', () => {
  beforeEach(() => {});

  it('should return the correct data after logThumbnail', () => {
    var fakezipfile = {
      async: () => q.when('test')
    };
    var testZip = {
      name: 'Test.zip',
      thumbnail: 'testThumbnail',
      description: 'TestDescription',
      file: () => fakezipfile
    };

    return modelsService
      .logThumbnail(testZip, 'basename')
      .should.eventually.equal('data:image/png;base64,test');
  });

  it('should return zip basename', () => {
    return q
      .denodeify(fs.readFile)(
        path.join(__dirname, '../data/models/icub_model.zip')
      )
      .then(zipContent => jszip.loadAsync(zipContent))
      .then(zipContent => modelsService.getZipBasename(zipContent))
      .should.eventually.equal('icub_model');
  });

  it('should extract metadata from Zip', () => {
    modelsService.logConfig = function() {
      return q.when({
        name: 'config',
        description: 'description',
        brain: undefined,
        sdf: 'model.sdf',
        configPath: 'modelID/model.config'
      });
    };
    modelsService.logThumbnail = function() {
      return q.when('thumbnail');
    };
    modelsService.getZipBasename = function() {
      return 'basename';
    };

    var expectedResult = {
      name: 'config',
      displayName: 'config',
      ownerId: 'userId',
      type: 'type',
      isShared: false,
      isCustom: true,
      description: 'description',
      thumbnail: 'thumbnail',
      path: 'basename',
      script: undefined,
      scriptPath: undefined,
      sdf: 'model.sdf',
      configPath: 'basename/model.config'
    };

    return modelsService
      .getZipModelMetaData(fakeModel, 'fileContent')
      .should.eventually.deep.equal(expectedResult);
  });

  it('should not extract metadata from Zip if name is undefined', () => {
    modelsService.logConfig = function() {
      return q.when({
        name: undefined,
        description: 'description',
        brain: undefined,
        sdf: 'model.sdf',
        configPath: 'modelID/model.config'
      });
    };
    modelsService.logThumbnail = function() {
      return q.when('thumbnail');
    };
    modelsService.getZipBasename = function() {
      return 'basename';
    };

    return expect(
      modelsService.getZipModelMetaData(fakeModel, 'fileContent')
    ).to.be.rejectedWith();
  });

  it('should not extract metadata from Zip if name is an empty string', () => {
    modelsService.logConfig = function() {
      return q.when({
        name: '',
        description: 'description',
        brain: undefined,
        sdf: 'model.sdf',
        configPath: 'modelID/model.config'
      });
    };
    modelsService.logThumbnail = function() {
      return q.when('thumbnail');
    };
    modelsService.getZipBasename = function() {
      return 'basename';
    };

    return expect(
      modelsService.getZipModelMetaData(fakeModel, 'fileContent')
    ).to.be.rejectedWith();
  });
});
