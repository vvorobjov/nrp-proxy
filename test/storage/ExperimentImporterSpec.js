'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path'),
  fs = require('fs'),
  q = require('q');

const folderName = 'test_experiment_folder';
class StorageMock {
  getStoragePath() {
    return path.join(__dirname, '../data/experiments');
  }
  createUniqueExperimentId(token, userId, folderName, contextId) {
    return Promise.resolve(`${folderName}_0`);
  }
  insertExperimentInDB(userId, destFolderName) {
    return Promise.resolve();
  }
  extractZip(userId, zipContent) {
    return Promise.resolve();
  }
  renameExperiment(experimentPath, newName, token, userId) {
    return 'newName';
  }
}

describe('Experiment importer', () => {
  let experimentImporter;
  const token = 'token-123';
  const userId = 'nrpuser';
  const contextId = 'context-id-123';
  let storageMock = new StorageMock();
  let createUniqueExperimentIdSpy = sinon
    .spy(storageMock, 'createUniqueExperimentId')
    .withArgs(token, userId, folderName, contextId);
  let insertExperimentInDBSpy = sinon
    .spy(storageMock, 'insertExperimentInDB')
    .withArgs(userId, `${folderName}_0`);
  let extractZipSpy = sinon.spy(storageMock, 'extractZip');
  beforeEach(() => {
    let RewiredExperimentImporter = rewire('../../storage/ExperimentImporter');
    experimentImporter = new RewiredExperimentImporter.ExperimentImporter(
      storageMock,
      token,
      userId,
      contextId
    );
    createUniqueExperimentIdSpy.resetHistory();
    insertExperimentInDBSpy.resetHistory();
    extractZipSpy.resetHistory();
  });

  it(`should create a unique experiment ID`, () => {
    return experimentImporter.createUniqueExperimentId(folderName).then(id => {
      expect(id).to.equal(`${folderName}_0`);
      expect(createUniqueExperimentIdSpy.called).to.be.true;
    });
  });

  it(`should register an imported zip experiment`, () => {
    const zipExperimentPath = path.join(
      __dirname,
      '../data/experiments/test_experiment_folder.zip'
    );
    return q
      .denodeify(fs.readFile)(zipExperimentPath)
      .then(zipFileContent =>
        experimentImporter.registerZippedExperiment(zipFileContent)
      )
      .then(response => {
        expect(extractZipSpy.called).to.be.true;
        expect(insertExperimentInDBSpy.called).to.be.true;
        return response;
      })
      .should.eventually.deep.equal({
        message: `The experiment folder has been succesfully imported`,
        zipBaseFolderName: folderName,
        destFolderName: `${folderName}_0`,
        newName: 'newName'
      });
  });

  it(`should throw an exception if the zip experiment does not contain any folder`, () => {
    const zipExperimentPath = path.join(
      __dirname,
      '../data/experiments/test_experiment_no_folder.zip'
    );
    return q
      .denodeify(fs.readFile)(zipExperimentPath)
      .then(zipFileContent =>
        experimentImporter.registerZippedExperiment(zipFileContent)
      )
      .catch(err => expect(err).to.be.defined);
  });

  it(`should throw an exception if the zip experiment contains multiple folders`, () => {
    const zipExperimentPath = path.join(
      __dirname,
      '../data/experiments/test_experiment_multiple_folders.zip'
    );
    return q
      .denodeify(fs.readFile)(zipExperimentPath)
      .then(zipFileContent =>
        experimentImporter.registerZippedExperiment(zipFileContent)
      )
      .catch(err => expect(err).to.be.defined);
  });
});
