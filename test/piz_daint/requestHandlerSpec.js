'use strict';
/*jshint expr: true*/

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var rewire = require('rewire');
var sinon = require('sinon');
var nock = require('nock');

var testConf = rewire('../utils/testConf');
var revert = function() {};
var requestHandlerRewired = rewire('../../piz_daint/requestHandler');
var requestHandler = requestHandlerRewired.default;

describe('requestHandler', function() {
  beforeEach(function() {
    nock.cleanAll();
    testConf.mockResponses();
    testConf.mockSuccessfulOidcResponse();
    requestHandler.initialize(testConf.config);
    requestHandlerRewired.__set__({
      console: testConf.consoleMock,
      configuration: testConf.config
    });
  });

  afterEach(function() {
    revert();
  });

  it('submitJob should get job location after submitting job', function() {
    const resp = [{ statusCode: 200, headers: { location: '/job_location' } }];
    revert = requestHandlerRewired.__set__('getIPAndPort', () => {
      return new Promise(function(resolve) {
        resolve(['serverIP', 'serverPort']);
      });
    });
    requestHandlerRewired.__set__('request', () => {
      return new Promise(function(resolve) {
        resolve(resp);
      });
    });
    return requestHandlerRewired
      .__get__('submitJob')('fakeToken', 'server')
      .should.eventually.deep.equal('/job_location');
  });

  it('getIPAndPort should get IP and port', function() {
    let promise = new Promise(function(resolve) {
      resolve({ gzweb: { 'nrp-services': 'http://localhost:9000' } });
    });
    let getServer = sinon.stub();
    getServer.returns(promise);
    revert = requestHandlerRewired.__set__({
      'proxyRequestHandler.getServer': getServer
    });
    return requestHandlerRewired
      .__get__('getIPAndPort')('server')
      .should.eventually.deep.equal(['localhost', '9000']);
  });

  it('getIPAndPort should get IP and port when no server has been selected', function() {
    let promise = new Promise(function(resolve) {
      resolve([{ gzweb: { 'nrp-services': 'http://localhost:9000' } }]);
    });
    let getBackend = sinon.stub();
    getBackend.returns(promise);
    revert = requestHandlerRewired.__set__({
      'proxyRequestHandler.getServersWithNoBackend': getBackend
    });
    return requestHandlerRewired
      .__get__('getIPAndPort')()
      .should.eventually.deep.equal(['localhost', '9000']);
  });

  it('setUpJob should set up the job', async function() {
    let promise = new Promise(function(resolve) {
      resolve('job_location');
    });
    let submitJob = sinon.stub();
    submitJob.returns(promise);

    promise = new Promise(function(resolve) {
      resolve({
        _links: {
          workingDirectory: { href: 'workingDirLink' },
          'action:start': { href: 'startLink' }
        }
      });
    });
    let getJobStatus = sinon.stub();
    getJobStatus.returns(promise);

    promise = new Promise(function(resolve) {
      resolve();
    });
    let uploadFilesForJob = sinon.stub();
    uploadFilesForJob.returns(promise);

    promise = new Promise(function(resolve) {
      resolve();
    });
    let invokeAction = sinon.stub();
    invokeAction.returns(promise);

    revert = requestHandlerRewired.__set__({
      submitJob: submitJob,
      getJobStatus: getJobStatus,
      uploadFilesForJob: uploadFilesForJob,
      invokeAction: invokeAction
    });
    var job_output = await requestHandler.setUpJob('fakeToken', 'localhost');
    expect(job_output).to.equal('job_location');
    expect(
      submitJob.firstCall.calledWithExactly('fakeToken', 'localhost')
    ).to.equal(true);
    expect(
      getJobStatus.firstCall.calledWithExactly('fakeToken', 'job_location')
    ).to.equal(true);
    expect(
      uploadFilesForJob.firstCall.calledWithExactly(
        'fakeToken',
        'workingDirLink/files'
      )
    ).to.equal(true);
    expect(
      invokeAction.firstCall.calledWithExactly('fakeToken', 'startLink')
    ).to.equal(true);
  });

  it('readUpload should read a file and upload', async function() {
    let resp = 'myFile';
    let promise = new Promise(function(resolve) {
      resolve(resp);
    });
    let fs_readFile = sinon.stub();
    fs_readFile.returns(promise);
    requestHandlerRewired.__set__('fsReadFile', fs_readFile);

    resp = [{ statusCode: 200 }];
    promise = new Promise(function(resolve) {
      resolve(resp);
    });
    let request = sinon.stub();
    request.returns(promise);
    requestHandlerRewired.__set__('request', request);

    let headerStub = sinon.stub();
    headerStub.returns({ method: 'PUT', headers: {} });
    requestHandlerRewired.__set__('getPizDaintHeaders', headerStub);

    await requestHandlerRewired.__get__('readUpload')(
      'fakeToken',
      'read_from',
      'upload_to'
    );
    let finalHeaders = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      json: false,
      body: 'myFile'
    };
    expect(
      fs_readFile.firstCall.calledWithExactly('read_from', 'utf8')
    ).to.equal(true);
    expect(
      request.firstCall.calledWithExactly('upload_to', finalHeaders)
    ).to.equal(true);
  });

  it('uploadFiles should upload files needed for the job', function() {
    let promise = new Promise(function(resolve) {
      resolve();
    });
    let readUploadStub = sinon.stub();
    readUploadStub.returns(promise);
    revert = requestHandlerRewired.__set__('readUpload', readUploadStub);
    requestHandlerRewired.__get__('uploadFilesForJob')(
      'fakeToken',
      '/file_url'
    );
    expect(
      readUploadStub.firstCall.calledWithExactly(
        'fakeToken',
        'undefined/input.sh',
        '/file_url/input.sh'
      )
    ).to.equal(true);
    expect(
      readUploadStub.secondCall.calledWithExactly(
        'fakeToken',
        'undefined/key-tunneluser',
        '/file_url/key-tunneluser'
      )
    ).to.equal(true);
  });

  it('invokeAction should do an action', async function() {
    let promise = new Promise(function(resolve) {
      resolve([{ statusCode: 200 }]);
    });
    let requestStub = sinon.stub();
    requestStub.returns(promise);
    requestHandlerRewired.__set__('request', requestStub);

    let headerStub = sinon.stub();
    headerStub.returns({ method: 'POST' });
    requestHandlerRewired.__set__('getPizDaintHeaders', headerStub);

    await requestHandlerRewired.__get__('invokeAction')(
      'fakeToken',
      'fake_url'
    );
    expect(
      requestStub.firstCall.calledWithExactly('fake_url', {
        method: 'POST',
        body: {}
      })
    ).to.equal(true);
  });

  it('getFile should get file from job', async function() {
    let promise = new Promise(function(resolve) {
      resolve([{ statusCode: 200, body: 'fakeBody' }]);
    });
    let requestStub = sinon.stub();
    requestStub.returns(promise);
    requestHandlerRewired.__set__('request', requestStub);

    let headerStub = sinon.stub();
    headerStub.returns({ method: 'GET', headers: {} });
    requestHandlerRewired.__set__('getPizDaintHeaders', headerStub);

    var response = await requestHandlerRewired.__get__('getFile')(
      'fakeToken',
      'fake_url'
    );
    expect(response).to.equal('fakeBody');
    expect(
      requestStub.firstCall.calledWithExactly('fake_url', {
        method: 'GET',
        headers: { Accept: 'application/octet-stream' }
      })
    ).to.equal(true);
  });

  it('get job outcome should get all files from job', async function() {
    let promise = new Promise(function(resolve) {
      resolve();
    });
    let getFileStub = sinon.stub();
    getFileStub.returns(promise);

    promise = new Promise(function(resolve) {
      resolve({ _links: { workingDirectory: { href: 'workingDirLink' } } });
    });
    let getJobStatus = sinon.stub();
    getJobStatus.returns(promise);

    revert = requestHandlerRewired.__set__({
      getFile: getFileStub,
      getJobStatus: getJobStatus
    });
    await requestHandler.getJobOutcome('fakeToken', 'file_url');
    expect(
      getFileStub.firstCall.calledWithExactly(
        'fakeToken',
        'workingDirLink/files/stdout'
      )
    ).to.equal(true);
    expect(
      getFileStub.secondCall.calledWithExactly(
        'fakeToken',
        'workingDirLink/files/stderr'
      )
    ).to.equal(true);
  });

  it('getJobStatus should get job status', async function() {
    const resp = { url: [{ statusCode: 200, body: { status: 'RUNNING' } }] };
    requestHandlerRewired.__set__('request', url => {
      return new Promise(function(resolve) {
        resolve(resp[url]);
      });
    });
    let headerSpy = sinon.spy();
    requestHandlerRewired.__set__('getPizDaintHeaders', headerSpy);
    let jobOutput = await requestHandler.getJobStatus('fakeToken', 'url');

    expect(jobOutput).to.deep.equal({ status: 'RUNNING' });
    sinon.assert.calledWith(headerSpy, 'fakeToken', 'GET');
  });

  it('getJobs should get every jobs status', async function() {
    let jobs = ['job1', 'job2', 'job3'];
    const resp = [{ statusCode: 200, body: { jobs: jobs } }];
    requestHandlerRewired.__set__('request', () => {
      return new Promise(function(resolve) {
        resolve(resp);
      });
    });
    let status = { job1: 'FAILED', job2: 'RUNNING', job3: 'STAGINGIN' };
    requestHandlerRewired.__set__('getJobStatus', (_, jobUrl) => {
      return new Promise(function(resolve) {
        resolve({ jobUrl: jobUrl, status: status[jobUrl] });
      });
    });
    let headerSpy = sinon.spy();
    requestHandlerRewired.__set__('getPizDaintHeaders', headerSpy);
    let jobOutput = await requestHandler.getJobs('fakeToken');
    expect(jobOutput).to.deep.equal([
      { jobUrl: 'job1', status: 'FAILED' },
      { jobUrl: 'job2', status: 'RUNNING' },
      { jobUrl: 'job3', status: 'STAGINGIN' }
    ]);

    sinon.assert.calledWith(headerSpy, 'fakeToken', 'GET');
  });
});
