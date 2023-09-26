'use strict';

const fs = require('fs-extra');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const rewire = require('rewire');
const expect = chai.expect;
const sinon = require('sinon');
const path = require('path');

chai.use(chaiAsPromised);

process.env = Object.assign(process.env, { STORAGE_PATH: 'nrp/Storage/Path' });
const fsUtils = rewire('../../storage/FS/utils.ts');

describe('FS Storage utils', () => {
  describe('storagePath', () => {
    it('should have the correct value', () => {
      const storagePath = fsUtils.__get__('storagePath');
      expect(storagePath).to.equal('nrp/Storage/Path');
    });
  });

  describe('generateUniqueExperimentId', () => {
    it('should return a unique experiment id', () => {
      const uniqueId = fsUtils.__get__('generateUniqueExperimentId')(
        'basename',
        'suffix',
        ['basename_suffix']
      );
      expect(uniqueId).to.equal('basename_suffix1');
    });
  });

  describe('getCurrentTimeAndDate', () => {
    it('should return the current time and date', () => {
      const timeAndDate = fsUtils.__get__('getCurrentTimeAndDate')();
      expect(timeAndDate).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('updateTimeAndDate', () => {
    it('should replace the timestamp in the string', () => {
      const newString = fsUtils.__get__('updateTimeAndDate')(
        'Timestamp: 2022-12-31T23:59:59'
      );
      expect(newString).to.not.contain('2022-12-31T23:59:59');
      expect(newString).to.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should append a timestamp if not present', () => {
      const newString = fsUtils.__get__('updateTimeAndDate')(
        'No timestamp here.'
      );
      expect(newString).to.match(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2} No timestamp here\.$/
      );
    });
  });
});
