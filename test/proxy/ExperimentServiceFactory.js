'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var nock = require('nock');
var sinon = require('sinon');
const q = require('q');
const {
    default: ExperimentServiceFactory
  } = require('../../proxy/ExperimentServiceFactory'),
  { default: RequestHandler } = require('../../storage/requestHandler');
let configFile = {
  storage: 'FS',
  authentication: 'FS'
};
var mockedExcFile = {
  uuid: 'experiment_configuration.exc',
  contentType: 'text/plain',
  contentDisposition: ''
};

var excFilebody = `
<?xml version="1.0" encoding="utf-8"?>
<ExD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns="http://schemas.humanbrainproject.eu/SP10/2014/ExDConfig"
    xsi:schemaLocation="http://schemas.humanbrainproject.eu/SP10/2014/ExDConfig ../ExDConfFile.xsd">
    <name>The Experiment</name>
    <thumbnail>thumbnail.jpg</thumbnail>
    <description>
      Nothing interesting
    </description>
    <tags>robotics braitenberg</tags>
    <timeout>80</timeout>
    <configuration type="3d-settings" src="3d-settings.ini"/>
    <configuration type="brainvisualizer" src="brainviz-settings.json"/>
  <configuration type="user-interaction-settings" src="settings.uis"/>
    <maturity>production</maturity>
    <environmentModel src="virtual_room_lausanne/virtual_room.sdf">
        <robotPose x="0" y="0" z="0.5" roll="0" pitch="0" yaw="3.1"/>
    </environmentModel>
    <bibiConf src="bibi_configuration.bibi" processes="2"/>
    <cameraPose>
        <cameraPosition x="2" y="1" z="3"/>
        <cameraLookAt x="0" y="5" z="0"/>
    </cameraPose>
</ExD>
`;
var alternateExcBody = `
<?xml version="1.0" encoding="utf-8"?>
<ExD>
    <name>The Experiment</name>
</ExD>
`;
var expectedExcConfObject = {
  ExD: {
    _xmlns: 'http://schemas.humanbrainproject.eu/SP10/2014/ExDConfig',
    '_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    '_xsi:schemaLocation':
      'http://schemas.humanbrainproject.eu/SP10/2014/ExDConfig ../ExDConfFile.xsd',
    bibiConf: {
      _src: 'bibi_configuration.bibi',
      _processes: '2'
    },
    cameraPose: {
      cameraLookAt: {
        _x: '0',
        _y: '5',
        _z: '0'
      },
      cameraPosition: {
        _x: '2',
        _y: '1',
        _z: '3'
      }
    },
    configuration: [
      {
        _src: '3d-settings.ini',
        _type: '3d-settings'
      },
      {
        _src: 'brainviz-settings.json',
        _type: 'brainvisualizer'
      },
      {
        _src: 'settings.uis',
        _type: 'user-interaction-settings'
      }
    ],
    description: 'Nothing interesting',
    environmentModel: {
      _src: 'virtual_room_lausanne/virtual_room.sdf',
      robotPose: {
        _pitch: '0',
        _roll: '0',
        _x: '0',
        _y: '0',
        _yaw: '3.1',
        _z: '0.5'
      }
    },
    maturity: 'production',
    name: 'The Experiment',
    tags: 'robotics braitenberg',
    thumbnail: 'thumbnail.jpg',
    timeout: '80'
  }
};
var mockedBibiBody = `
<?xml version="1.0" encoding="UTF-8"?>
<bibi xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xmlns="http://schemas.humanbrainproject.eu/SP10/2014/BIBI"
xsi:schemaLocation="http://schemas.humanbrainproject.eu/SP10/2014/BIBI ../bibi_configuration.xsd">
  <brainModel>
    <file>brain_model/braitenberg.py</file>
    <populations population="sensors" xsi:type="Range" from="0" to="5"/>
    <populations population="actors" xsi:type="Range" from="5" to="8"/>
  </brainModel>
  <bodyModel>husky_model/model.sdf</bodyModel>
  <transferFunction xsi:type="PythonTransferFunction" src="csv_robot_position.py"/>
</bibi>`;
var expectedBibiConfObject = {
  bibi: {
    _xmlns: 'http://schemas.humanbrainproject.eu/SP10/2014/BIBI',
    '_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    '_xsi:schemaLocation':
      'http://schemas.humanbrainproject.eu/SP10/2014/BIBI ../bibi_configuration.xsd',
    bodyModel: 'husky_model/model.sdf',
    brainModel: {
      file: 'brain_model/braitenberg.py',
      populations: [
        {
          _from: '0',
          _population: 'sensors',
          _to: '5',
          '_xsi:type': 'Range'
        },
        {
          _from: '5',
          _population: 'actors',
          _to: '8',
          '_xsi:type': 'Range'
        }
      ]
    },
    transferFunction: {
      _src: 'csv_robot_position.py',
      '_xsi:type': 'PythonTransferFunction'
    }
  }
};
var experimentId = '1234',
  contextId = 111 - 222 - 333;
var rh;

describe('ExperimentServiceFactory', function() {
  beforeEach(function() {
    nock.cleanAll();
    rh = new RequestHandler(configFile);
    mockedExcFile.body = excFilebody;
  });

  it('getExc() should get the .exc configuration file', function() {
    sinon.stub(rh, 'getFile').returns(q.when(mockedExcFile));
    var esf = new ExperimentServiceFactory(rh);
    var es = esf.createExperimentService(experimentId, contextId);
    return es
      .getExc()
      .should.eventually.deep.equal([
        expectedExcConfObject,
        'experiment_configuration.exc',
        excFilebody
      ]);
  });

  it('.getBibi() should get the .bibi configuration file', function() {
    sinon
      .stub(rh, 'getFile')
      .returns(Promise.resolve({ body: mockedBibiBody }));
    var esf = new ExperimentServiceFactory(rh);
    var es = esf.createExperimentService(experimentId, contextId);
    sinon
      .stub(es, 'getExc')
      .returns(
        Promise.resolve([expectedExcConfObject, 'experiment_configuration.exc'])
      );
    return es
      .getBibi()
      .should.eventually.deep.equal([
        expectedBibiConfObject,
        'bibi_configuration.bibi'
      ]);
  });

  it('.getConfig() should get the configuration information object', function() {
    sinon.stub(rh, 'getFile').returns(q.when(mockedExcFile));
    var esf = new ExperimentServiceFactory(rh);
    var es = esf.createExperimentService(experimentId, contextId);
    sinon
      .stub(es, 'getBibi')
      .returns(
        Promise.resolve([expectedBibiConfObject, 'bibi_configuration.bibi'])
      );
    return es.getConfig().then(function(res) {
      expect(res.bibiConfSrc).to.equal('bibi_configuration.bibi');
      expect(res.brainProcesses).to.equal(2);
      expect(res.maturity).to.equal('production');
    });
  });

  it('.getConfig() should get the configuration information object (testing branches)', function() {
    mockedExcFile.body = alternateExcBody;
    sinon.stub(rh, 'getFile').returns(q.when(mockedExcFile));
    var esf = new ExperimentServiceFactory(rh);
    var es = esf.createExperimentService(experimentId, contextId);
    sinon.stub(es, 'getBibi').throws();
    return es.getConfig().then(function(res) {
      expect(res.bibiConfSrc).to.equal(undefined);
      expect(res.brainProcesses).to.equal(undefined);
      expect(res.timeout).to.equal(600);
      expect(res.maturity).to.equal('development');
    });
  });

  it('.getCSVFiles() should get the csv files', async () => {
    sinon.stub(rh, 'listFiles', folder => {
      switch (folder) {
        case experimentId:
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
    const csvFiles = await es.getCSVFiles();

    expect(csvFiles).to.eql([
      { uuid: '1234%2Fcsv_records_2%2Fcsvfile' },
      { uuid: '1234%2Fcsv_records_1%2Fcsvfile' }
    ]);
    return csvFiles;
  });
});
