'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path'),
  fs = require('fs');

import X2JS from 'x2js';

var zippedRobotPath = path.join(
  __dirname,
  'dbMock',
  'USER_DATA',
  'robots',
  'husky_model.zip'
);

const templateNewPath = path.join(
  __dirname,
  '..',
  'data',
  'experiments',
  'template_new',
  'TemplateNew.exc'
);

var robotZip = fs.readFileSync(zippedRobotPath);
const templateNewFile = fs.readFileSync(templateNewPath);
const templateNewXml = new X2JS().xml2js(templateNewFile.toString());
class StorageMock {
  async listExperiments() {
    return [{ name: 'experiment1' }];
  }

  async createExperiment() {
    return { uuid: 'openAI_nest_py_0' };
  }

  async createOrUpdate() {
    return {};
  }

  async getModelZip() {
    return robotZip;
  }
  async deleteExperiment() {
    return {};
  }

  async createFolder() {
    return {};
  }

  async getModelFullPath() {}
}

const fsMock = {
  writeFileSync: sinon.spy(),
  readFileSync: sinon.spy(),
  copy: sinon.stub().returns(Promise.resolve()),
  ensureDir: sinon.stub().returns(Promise.resolve()),
  existsSync: sinon.stub().returns(true),
  exists: sinon.stub().returns(true),
  readdir: sinon.stub().returns(['pythonfile.py']),
  lstatSync: sinon.stub().returns({
    isDirectory: () => true,
    isFile: () => true
  }),
  readdirSync: sinon
    .stub()
    .returns([
      'TemplateNew.3ds',
      'TemplateNew.bibi',
      'TemplateNew.exc',
      'TemplateNew.jpg'
    ])
};

let tmpMock = {
  dirSync: sinon.stub().returns({
    name: 'test/data/experiments/template_new',
    removeCallback: () => {}
  }),
  tmpDir: 'test'
};

describe('Experiment cloner', () => {
  let config = {
    nrpVersion: '4.0.0',
    modelsPath: 'test/data/models',
    templatesPath: 'test/data/experiments'
  };

  const storageMock = new StorageMock(),
    ExperimentCloner = rewire('../../storage/ExperimentCloner');
  const templateCloner = new ExperimentCloner.TemplateExperimentCloner(
    storageMock,
    config
  );
  ExperimentCloner.__set__('fs', fsMock);

  const templateCreateUniqueExperimentId = sinon
      .stub(templateCloner, 'createUniqueExperimentId')
      .returns('openAI_nest_py_0'),
    templateDownloadFile = sinon.spy(templateCloner, 'downloadFile'),
    createExperiment = sinon.spy(storageMock, 'createExperiment');

  it(`should correctly clone openAI_nest_py`, async () => {
    const res = await templateCloner.cloneExperiment(
      'faketoken',
      'fakeusrid',
      'openAI_nest_py/simulation_config.json'
    );

    expect(templateCreateUniqueExperimentId.callCount).to.equal(1);
    expect(createExperiment.callCount).to.equal(1);
    // we download the robot model, the env model, the brain
    // plus the .png and the .3ds files plus any tfs if they exist
    expect(templateDownloadFile.callCount).to.equal(5);
    expect(fsMock.copy.callCount).to.equal(5);
    // we write the exc and bibi
    expect(fsMock.writeFileSync.callCount).to.equal(0);
    //should read everything
    expect(fsMock.readFileSync.callCount).to.equal(5);

    expect(createExperiment.firstCall.args[0]).to.equal('openAI_nest_py_0');
    expect(
      await templateCreateUniqueExperimentId.firstCall.returnValue
    ).to.equal('openAI_nest_py_0');
    expect(res).to.equal((await storageMock.createExperiment()).uuid);
  });
});
