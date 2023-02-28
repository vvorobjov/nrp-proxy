'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var nock = require('nock');
var sinon = require('sinon');
const q = require('q');
const path = require('path');
const {
    default: ExperimentServiceFactory
  } = require('../../proxy/ExperimentServiceFactory'),
  { default: RequestHandler } = require('../../storage/requestHandler');
let configFile = {
  nrpVersion: '4.0.0',
  storage: 'FS',
  authentication: 'FS'
};

var experimentId = 'experiment1',
  contextId = 111 - 222 - 333;
var rh;

describe('ExperimentServiceFactory', function() {
  beforeEach(function() {
    nock.cleanAll();
    rh = new RequestHandler(configFile);
    sinon.stub(rh, 'getStoragePath').returns('test/data/experiments');
  });

  it('.getFiles() should get the files', async () => {
    sinon.stub(rh, 'listFiles', folder => {
      switch (folder) {
        case experimentId + '/csv_records':
          return q.when([
            {
              name: 'NOT_csv_records',
              type: 'folder'
            },
            {
              name: 'csv_records_2',
              type: 'folder'
            },
            {
              name: 'csv_records_1',
              type: 'folder'
            }
          ]);
        case experimentId + '/profiler_data':
          return q.when([
            {
              name: 'NOT_profiler_data',
              type: 'folder'
            },
            {
              name: 'profiler_data_2',
              type: 'folder'
            },
            {
              name: 'profiler_data_1',
              type: 'folder'
            }
          ]);
        default:
          return q.when([
            {
              uuid: `${folder}/csvfile`
            }
          ]);
      }
    });
    var esf = new ExperimentServiceFactory(rh);
    var es = esf.createExperimentService(experimentId, contextId);
    const csvFiles = await es.getFiles('csv');
    const profilerFiles = await es.getFiles('profiler');

    expect(csvFiles).to.eql([
      {
        folder: '2',
        uuid: 'experiment1%2Fcsv_records%2Fcsv_records_2%2Fcsvfile'
      },
      {
        folder: '1',
        uuid: 'experiment1%2Fcsv_records%2Fcsv_records_1%2Fcsvfile'
      }
    ]);

    expect(profilerFiles).to.eql([
      {
        folder: '2',
        uuid: 'experiment1%2Fprofiler_data%2Fprofiler_data_2%2Fcsvfile'
      },
      {
        folder: '1',
        uuid: 'experiment1%2Fprofiler_data%2Fprofiler_data_1%2Fcsvfile'
      }
    ]);
    return { csvFiles, profilerFiles };
  });

  it('TemplateExperimentService has not implemented listFiles()', async () => {
    var esf = new ExperimentServiceFactory(rh);
    var es = esf.createExperimentService(experimentId, contextId, true);
    await expect(es.listFiles('')).to.be.rejectedWith('Not implemented');
  });

  it('TemplateExperimentService has not implemented saveFile()', async () => {
    var esf = new ExperimentServiceFactory(rh);
    var es = esf.createExperimentService(experimentId, contextId, true);
    await expect(es.saveFile('fileName', 'fileContent', 'contentType')).to.be
      .rejected;
  });

  it('.getConfig() for V4.0 should return the config if provided', function() {
    const fakeConfig = { SimulationName: 'name' };
    const fakeExpConfigResponse = {
      body: {
        toString: () => {
          return JSON.stringify(fakeConfig);
        }
      }
    };
    sinon.stub(rh, 'getFile').returns(q.when(fakeExpConfigResponse));
    var esf = new ExperimentServiceFactory(rh, configFile);
    var es = esf.createExperimentService(experimentId, contextId);
    return es.getConfig().then(response => {
      expect(response).deep.equal(fakeConfig);
    });
  });
});
