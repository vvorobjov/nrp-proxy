'use strict';

const chai = require('chai'),
  expect = chai.expect;

const experimentsPaths = 'test/data/experiments';

const expectedExp1 = {
  id: 'ExDTemplateHusky',
  name: 'Template Husky in empty environment',
  thumbnail: 'ExDTemplateHusky.jpg',
  path: 'experiment1',
  tags: [],
  description:
    'This experiment loads the Husky robot in an empty world, with an idle brain and basic transfer functions. You are free to edit it.',
  experimentConfiguration: 'experiment1/ExDTemplateHusky.exc',
  maturity: 'production',
  timeout: 840,
  physicsEngine: 'ode',
  brainProcesses: 1,
  cameraPose: [4.5, 0, 1.8, 0, 0, 0.6],
  visualModel: undefined,
  visualModelParams: undefined
};

const expectedExp2 = {
  id: 'ExDNao',
  name: 'NAO experiment',
  thumbnail: 'ExDNao.jpg',
  path: 'experiment2',
  tags: [],
  description:
    'This experiment loads the humanoid robot NAO (Aldebaran) and the virtual room environment. In the future, it will be possible to connect NAO to a neuronal controller (NEST) to control single joints of the robot.',
  experimentConfiguration: 'experiment2/ExDNao.exc',
  maturity: 'development',
  timeout: 840,
  physicsEngine: 'ode',
  brainProcesses: 1,
  cameraPose: [4.5, 0, 1.8, 0, 0, 0.6],
  visualModel: undefined,
  visualModelParams: undefined
};

describe('ExperimentsService', () => {
  let ExperimentsService = require('../../proxy/experimentsService.js'),
    experimentsService = new ExperimentsService(experimentsPaths);

  it('should construct an experiments Service instance with the correct path', () => {
    return expect(experimentsService.experimentsPath).to.contain(
      experimentsPaths
    );
  });

  it('should load experiment 1 properly', () => {
    return experimentsService.loadExperiments().then(experiments => {
      return expect(experiments[0]).to.deep.equal(expectedExp1);
    });
  });

  it('should load experiment 2 properly', () => {
    return experimentsService.loadExperiments().then(experiments => {
      return expect(experiments[1]).to.deep.equal(expectedExp2);
    });
  });
});
