'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  expect = chai.expect,
  path = require('path'),
  fs = require('fs');

var zippedRobotPath = path.join(
  __dirname,
  'dbMock',
  'USER_DATA',
  'nrpuser',
  'robots',
  'husky_model.zip'
);
var robotZip = fs.readFileSync(zippedRobotPath);
class StorageMock {
  async listExperiments() {
    return [{ name: 'experiment1' }];
  }

  async createExperiment() {
    return { uuid: 'new_exp_uuid' };
  }

  async createOrUpdate() {
    return {};
  }

  async getCustomModel() {
    return robotZip;
  }
  async deleteExperiment() {
    return {};
  }
}

const fsMock = {
  writeFileSync: sinon.spy(),
  readFileSync: sinon.spy(),
  copy: sinon.stub().returns(Promise.resolve()),
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
    modelsPath: 'test/data/models',
    experimentsPath: 'test/data/experiments'
  };

  const storageMock = new StorageMock(),
    ExperimentCloner = rewire('../../storage/ExperimentCloner.js');
  const baseCloner = new ExperimentCloner.ExperimentCloner(storageMock, config),
    templateCloner = new ExperimentCloner.TemplateExperimentCloner(
      storageMock,
      config
    );
  ExperimentCloner.__set__('fs', fsMock);

  const createUniqueExperimentId = sinon.spy(
      templateCloner,
      'createUniqueExperimentId'
    ),
    downloadFile = sinon.spy(templateCloner, 'downloadFile'),
    createExperiment = sinon.spy(storageMock, 'createExperiment');

  ['getBibiFullPath', 'getExperimentFileFullPath'].forEach(function(item) {
    it('should throw a non implemented method error when trying to use a base class non-overidden function ', () => {
      return expect(baseCloner[item]).to.throw('not implemented');
    });
  });

  it(`should correctly clone experiment1`, async () => {
    const res = await templateCloner.cloneExperiment(
      'faketoken',
      'fakeusrid',
      'experiment1/ExDTemplateHusky.exc'
    );

    expect(createUniqueExperimentId.callCount).to.equal(1);
    expect(createExperiment.callCount).to.equal(1);
    expect(downloadFile.callCount).to.equal(6);

    expect(fsMock.writeFileSync.callCount).to.equal(2);
    expect(fsMock.readFileSync.callCount).to.equal(8);
    expect(fsMock.copy.callCount).to.equal(6);

    expect(createExperiment.firstCall.args[0]).to.equal('experiment1_0');
    expect(await createUniqueExperimentId.firstCall.returnValue).to.equal(
      'experiment1_0'
    );
    expect(res).to.equal((await storageMock.createExperiment()).uuid);
  });

  it(`should correctly clone a new experiment`, async () => {
    // sinon.stub(newCloner, 'getExperimentFileFullPath').returns('test/data/experiments/template_new/TemplateNew.exc');
    // sinon.stub(newCloner, 'getBibiFullPath').returns('test/data/experiments/template_new/TemplateNew.bibi');
    var revert = ExperimentCloner.__set__('tmp', tmpMock);
    const mockModelsPaths = {
        brainPath: { path: 'brains/extended_braitenberg.py', custom: false },
        environmentPath: {
          path: 'environments/biologylab_world/model.config',
          custom: false
        },
        robotPath: { path: 'robots/icub_model/model.config', custom: false }
      },
      newCloner = new ExperimentCloner.NewExperimentCloner(
        storageMock,
        config,
        mockModelsPaths,
        'template_new/TemplateNew.exc'
      );
    const res = await newCloner.cloneExperiment(
      'faketoken',
      'fakeusrid',
      'template_new/TemplateNew.exc',
      'fakeContextId'
    );

    expect(createUniqueExperimentId.callCount).to.equal(1);
    expect(createExperiment.callCount).to.equal(3);
    expect(downloadFile.callCount).to.equal(6);

    expect(fsMock.writeFileSync.callCount).to.equal(6);
    expect(fsMock.readFileSync.callCount).to.equal(15);
    expect(fsMock.copy.callCount).to.equal(11);

    expect(createExperiment.firstCall.args[0]).to.equal('experiment1_0');
    expect(await createUniqueExperimentId.firstCall.returnValue).to.equal(
      'experiment1_0'
    );
    expect(res).to.equal((await storageMock.createExperiment()).uuid);
    expect(res).to.equal('new_exp_uuid');
    revert();
  });

  it(`should correctly clone a new experiment with zipped model`, async () => {
    // sinon.stub(newCloner, 'getExperimentFileFullPath').returns('test/data/experiments/template_new/TemplateNew.exc');
    // sinon.stub(newCloner, 'getBibiFullPath').returns('test/data/experiments/template_new/TemplateNew.bibi');
    var revert = ExperimentCloner.__set__('tmp', tmpMock);
    const mockModelsPaths = {
        brainPath: {
          path: 'brains/extended_braitenberg/extended_braitenberg.zip',
          custom: true
        },
        environmentPath: {
          path: 'environments/biologylab_world/model.zip',
          custom: true
        },
        robotPath: { path: 'robots/icub_model/icub.zip', custom: true }
      },
      newCloner = new ExperimentCloner.NewExperimentCloner(
        storageMock,
        config,
        mockModelsPaths,
        'template_new/TemplateNew.exc'
      );

    const res = await newCloner.cloneExperiment(
      'faketoken',
      'fakeusrid',
      'template_new/TemplateNew.exc',
      'fakeContextId'
    );

    expect(createUniqueExperimentId.callCount).to.equal(1);
    expect(createExperiment.callCount).to.equal(5);
    expect(downloadFile.callCount).to.equal(6);

    expect(fsMock.writeFileSync.callCount).to.equal(10);
    expect(fsMock.readFileSync.callCount).to.equal(19);
    expect(fsMock.copy.callCount).to.equal(13);

    expect(createExperiment.firstCall.args[0]).to.equal('experiment1_0');
    expect(await createUniqueExperimentId.firstCall.returnValue).to.equal(
      'experiment1_0'
    );
    expect(res).to.equal((await storageMock.createExperiment()).uuid);
    expect(res).to.equal('new_exp_uuid');
    revert();
  });
});
