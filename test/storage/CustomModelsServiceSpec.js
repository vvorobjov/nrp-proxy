'use strict';
const chai = require('chai'),
  assert = chai.assert;

describe('CustomModelsService', () => {
  const CustomModelsService = require('../../storage/CustomModelsService.js');
  let customModelsService = new CustomModelsService();
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
});
