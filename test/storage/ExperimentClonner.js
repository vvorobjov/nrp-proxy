'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  expect = chai.expect;

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
}

const fsMock = {
  writeFileSync: sinon.spy(),
  readFileSync: sinon.spy(),
  copy: sinon.stub().returns(Promise.resolve())
};
describe('Storage request handler', () => {
  let config = {
    modelsPath: 'test/data/models',
    experimentsPath: 'test/data/experiments'
  };

  const storageMock = new StorageMock(),
    ExperimentClonner = rewire('../../storage/ExperimentClonner.js'),
    clonner = new ExperimentClonner(storageMock, config);

  ExperimentClonner.__set__('fs', fsMock);

  it(`should correctly clone experiment1`, async () => {
    const createUniqueExperimentId = sinon.spy(
        clonner,
        'createUniqueExperimentId'
      ),
      downloadFile = sinon.spy(clonner, 'downloadFile'),
      createExperiment = sinon.spy(storageMock, 'createExperiment');

    const res = await clonner.cloneExperiment(
      'faketoken',
      'fakeusrid',
      'experiment1/ExDTemplateHusky.exc'
    );

    expect(createUniqueExperimentId.callCount).to.equal(1);
    expect(createExperiment.callCount).to.equal(1);
    expect(downloadFile.callCount).to.equal(7);

    expect(fsMock.writeFileSync.callCount).to.equal(2);
    expect(fsMock.readFileSync.callCount).to.equal(9);
    expect(fsMock.copy.callCount).to.equal(7);

    expect(createExperiment.firstCall.args[0]).to.equal('experiment1_0');
    expect(await createUniqueExperimentId.firstCall.returnValue).to.equal(
      'experiment1_0'
    );
    expect(res).to.equal((await storageMock.createExperiment()).uuid);
  });
});
