'use strict';
const chai = require('chai'),
  rewire = require('rewire'),
  assert = chai.assert,
  q = require('q');
let CustomModelsService, customModelsService;
let fakeJSZip = {
  loadAsync: () =>
    q.when({
      file: () => 'data'
    })
};
let fakeModel = {
  ownerId: 'userId',
  type: 'type',
  path: 'modelType/filename',
  isShared: false
};

CustomModelsService = rewire('../../storage/CustomModelsService');
CustomModelsService.__set__('jszip', fakeJSZip);
customModelsService = new CustomModelsService.default();

describe('CustomModelsService', () => {
  beforeEach(() => {});

  it('should reject if a zip is not setup correctly', () => {
    return assert.isRejected(
      customModelsService.validateZip('empty'),
      'name missing from the model zip file. Please add it to the model.config of the model zip file inside the root directory'
    );
  });

  it('should validate if a zip is setup correctly', () => {
    var testZip = {
      name: 'Test.zip',
      thumbnail: 'testThumbnail',
      description: 'TestDescription'
    };

    return customModelsService
      .validateZip(testZip)
      .should.eventually.equal(undefined);
  });

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

    return customModelsService
      .logThumbnail(testZip, 'basename')
      .should.eventually.equal('data:image/png;base64,test');
  });

  it('should extract metadata from Zip', () => {
    customModelsService.logConfig = function() {
      return q.when({
        name: 'config',
        description: 'description',
        brain: undefined,
        sdf: 'model.sdf',
        configPath: 'modelID/model.config'
      });
    };
    customModelsService.logThumbnail = function() {
      return q.when('thumbnail');
    };
    customModelsService.getZipBasename = function() {
      return 'basename';
    };

    var expectedResult = {
      name: 'config',
      displayName: 'config',
      ownerId: 'userId',
      type: 'type',
      fileName: 'filename',
      isShared: false,
      isCustom: true,
      description: 'description',
      thumbnail: 'thumbnail',
      path: 'modelType/filename',
      script: undefined,
      sdf: 'basename/model.sdf',
      configPath: 'modelID/model.config'
    };

    return customModelsService
      .getZipModelMetaData(fakeModel, 'fileContent')
      .should.eventually.deep.equal(expectedResult);
  });

  it('should extract file from Zip', () => {
    customModelsService.getZipBasename = function() {
      return 'basename';
    };
    // Interestingly enough , mocking the JSzip async function is virtually impossible
    // since async is now a reserved keyword in the new NodeJS framework, and thus
    // is treated as a keyword and not as an object property when I try to mock it
    // Best we can do for this test is check that the function fails.
    return assert.isRejected(
      customModelsService.extractFileFromZip('fileContent', 'fileName'),
      'modelData.async is not a function'
    );
  });
});
