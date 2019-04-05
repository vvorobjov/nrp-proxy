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

  async createFolder() {
    return {};
  }
}

const fsMock = {
  writeFileSync: sinon.spy(),
  readFileSync: sinon.spy(),
  copy: sinon.stub().returns(Promise.resolve()),
  ensureDir: sinon.stub().returns(Promise.resolve()),
  existsSync: sinon.stub().returns(true),
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
    modelsPath: 'test/data/models',
    experimentsPath: 'test/data/experiments'
  };

  const storageMock = new StorageMock(),
    ExperimentCloner = rewire('../../storage/ExperimentCloner');
  const templateCloner = new ExperimentCloner.TemplateExperimentCloner(
    storageMock,
    config
  );
  ExperimentCloner.__set__('fs', fsMock);

  const templateCreateUniqueExperimentId = sinon.spy(
      templateCloner,
      'createUniqueExperimentId'
    ),
    templateDownloadFile = sinon.spy(templateCloner, 'downloadFile'),
    createExperiment = sinon.spy(storageMock, 'createExperiment');

  it(`should correctly clone experiment1`, async () => {
    const res = await templateCloner.cloneExperiment(
      'faketoken',
      'fakeusrid',
      'experiment1/ExDTemplateHusky.exc'
    );

    expect(templateCreateUniqueExperimentId.callCount).to.equal(1);
    expect(createExperiment.callCount).to.equal(1);
    // we download the robot model, the env model, the brain
    // plus the .png and the .3ds files plus any tfs if they exist
    expect(templateDownloadFile.callCount).to.equal(5);
    expect(fsMock.copy.callCount).to.equal(5);
    // we write the exc and bibi
    expect(fsMock.writeFileSync.callCount).to.equal(2);
    //should read everything
    expect(fsMock.readFileSync.callCount).to.equal(7);

    expect(createExperiment.firstCall.args[0]).to.equal('experiment1_0');
    expect(
      await templateCreateUniqueExperimentId.firstCall.returnValue
    ).to.equal('experiment1_0');
    expect(res).to.equal((await storageMock.createExperiment()).uuid);
  });

  it(`should correctly clone a new experiment`, async () => {
    // sinon.stub(newCloner, 'getExperimentFileFullPath').returns('test/data/experiments/template_new/TemplateNew.exc');
    // sinon.stub(newCloner, 'getBibiFullPath').returns('test/data/experiments/template_new/TemplateNew.bibi');

    //reset mocks
    createExperiment.reset();
    fsMock.copy.reset();
    fsMock.writeFileSync.reset();
    fsMock.readFileSync.reset();
    var revert = ExperimentCloner.__set__('tmp', tmpMock);
    const environmentPath = {
        path: 'environments/biologylab_world/model.config',
        custom: false
      },
      newCloner = new ExperimentCloner.NewExperimentCloner(
        storageMock,
        config,
        environmentPath,
        'template_new/TemplateNew.exc'
      );
    var createUniqueExperimentId = sinon.spy(
      newCloner,
      'createUniqueExperimentId'
    );

    var downloadFile = sinon.spy(newCloner, 'downloadFile');
    const res = await newCloner.cloneExperiment(
      'faketoken',
      'fakeusrid',
      'template_new/TemplateNew.exc',
      'fakeContextId'
    );

    expect(createUniqueExperimentId.callCount).to.equal(1);
    expect(createExperiment.callCount).to.equal(1);
    // we download the robot model, the env model, the brain
    // plus the .png and the .3ds files plus any tfs if they exist
    expect(downloadFile.callCount).to.equal(3);
    expect(fsMock.copy.callCount).to.equal(3);
    // for the NewExperimentCloner experiment_configuration.exc and bibi_config are each written twice = 4
    expect(fsMock.writeFileSync.callCount).to.equal(4);
    // we read everything in the tmp dir so we can move it to the storage
    // so everything we downloaded plus the .exc and .bibi
    expect(fsMock.readFileSync.callCount).to.equal(5);

    expect(createExperiment.firstCall.args[0]).to.equal('template_new_0');
    expect(await createUniqueExperimentId.firstCall.returnValue).to.equal(
      'template_new_0'
    );
    expect(res).to.equal((await storageMock.createExperiment()).uuid);
    expect(res).to.equal('new_exp_uuid');
    revert();
  });

  it(`should correctly clone a new experiment with zipped model`, async () => {
    // sinon.stub(newCloner, 'getExperimentFileFullPath').returns('test/data/experiments/template_new/TemplateNew.exc');
    // sinon.stub(newCloner, 'getBibiFullPath').returns('test/data/experiments/template_new/TemplateNew.bibi');

    createExperiment.reset();
    fsMock.copy.reset();
    fsMock.writeFileSync.reset();
    fsMock.readFileSync.reset();

    var revert = ExperimentCloner.__set__('tmp', tmpMock);
    const environmentPath = {
        path: 'environments/biologylab_world/model.zip',
        custom: true
      },
      newCloner = new ExperimentCloner.NewExperimentCloner(
        storageMock,
        config,
        environmentPath,
        'template_new/TemplateNew.exc'
      );
    var createUniqueExperimentId = sinon.spy(
      newCloner,
      'createUniqueExperimentId'
    );
    var downloadFile = sinon.spy(newCloner, 'downloadFile');
    const res = await newCloner.cloneExperiment(
      'faketoken',
      'fakeusrid',
      'template_new/TemplateNew.exc',
      'fakeContextId'
    );

    expect(createUniqueExperimentId.callCount).to.equal(1);
    expect(createExperiment.callCount).to.equal(1);
    expect(downloadFile.callCount).to.equal(2);
    expect(fsMock.copy.callCount).to.equal(2);

    expect(fsMock.writeFileSync.callCount).to.equal(4);
    expect(fsMock.readFileSync.callCount).to.equal(4);

    expect(createExperiment.firstCall.args[0]).to.equal('template_new_0');
    expect(await createUniqueExperimentId.firstCall.returnValue).to.equal(
      'template_new_0'
    );
    expect(res).to.equal((await storageMock.createExperiment()).uuid);
    expect(res).to.equal('new_exp_uuid');
    revert();
  });

  it(`should correctly clone a new experiment with resources folder`, async () => {
    // sinon.stub(newCloner, 'getExperimentFileFullPath').returns('test/data/experiments/template_new/TemplateNew.exc');
    // sinon.stub(newCloner, 'getBibiFullPath').returns('test/data/experiments/template_new/TemplateNew.bibi');

    //reset mocks
    createExperiment.reset();
    fsMock.copy.reset();
    fsMock.writeFileSync.reset();
    fsMock.readFileSync.reset();
    let tmpMock = {
      dirSync: sinon.stub().returns({
        name: 'test/data/experiments/template_resources',
        removeCallback: () => {}
      }),
      tmpDir: 'test'
    };

    var revert = ExperimentCloner.__set__('tmp', tmpMock);
    const environmentPath = {
        path: 'environments/biologylab_world/model.config',
        custom: false
      },
      newCloner = new ExperimentCloner.NewExperimentCloner(
        storageMock,
        config,
        environmentPath,
        'template_resources/TemplateNew.exc'
      );
    var createUniqueExperimentId = sinon.spy(
      newCloner,
      'createUniqueExperimentId'
    );

    var downloadFile = sinon.spy(newCloner, 'downloadFile');
    const res = await newCloner.cloneExperiment(
      'faketoken',
      'fakeusrid',
      'template_resources/TemplateNew.exc',
      'fakeContextId'
    );

    expect(createUniqueExperimentId.callCount).to.equal(1);
    expect(createExperiment.callCount).to.equal(1);
    // we download the robot model, the env model, the brain
    // plus the .png and the .3ds files plus any tfs if they exist
    expect(downloadFile.callCount).to.equal(3);
    expect(fsMock.copy.callCount).to.equal(3);
    // for the NewExperimentCloner experiment_configuration.exc and bibi_config are each written twice = 4
    expect(fsMock.writeFileSync.callCount).to.equal(4);
    // we read everything in the tmp dir so we can move it to the storage
    // so everything we downloaded plus the .exc and .bibi plus anything in resources
    expect(fsMock.readFileSync.callCount).to.equal(9);

    expect(createExperiment.firstCall.args[0]).to.equal('template_resources_0');
    expect(await createUniqueExperimentId.firstCall.returnValue).to.equal(
      'template_resources_0'
    );
    expect(res).to.equal((await storageMock.createExperiment()).uuid);
    expect(res).to.equal('new_exp_uuid');
    revert();
  });
});
