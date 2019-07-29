'use strict';

const rewire = require('rewire'),
  q = require('q');
let RewiredExperimentZipper = rewire('../../storage/ExperimentZipper');

const tmpMock = {
  dirSync: () => ({ name: 'tmpFolder' }),
  fileSync: () => {
    return { name: 'tmpFile' };
  }
};

const fsMock = {
  copySync: () => undefined
};

const FakeZip = { zip: () => q.resolve() };

RewiredExperimentZipper.__set__('tmp', tmpMock);
RewiredExperimentZipper.__set__('mkdir', () => q.resolve());
RewiredExperimentZipper.__set__('fs', fsMock);
RewiredExperimentZipper.__set__('zip', FakeZip);

class StorageMock {
  listExperiments() {
    return [{ name: 'experimentId' }];
  }
}

describe('Experiment Zipper', () => {
  it(`should zip an experiment`, () => {
    let experimentZipper = new RewiredExperimentZipper.ExperimentZipper(
      new StorageMock(),
      'token',
      'userId'
    );
    return experimentZipper
      .zipExperiment('experimentId')
      .should.eventually.equal('tmpFile');
  });
});
