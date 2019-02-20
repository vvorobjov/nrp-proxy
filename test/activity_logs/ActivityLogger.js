'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var rewire = require('rewire');
var sinon = require('sinon');
var assert = chai.assert;
const q = require('q');
const ActivityLoggerRewire = rewire('../../activity_logs/ActivityLogger'),
  { default: ActivityLogger } = ActivityLoggerRewire;

var refMock = {
  set: sinon.stub().returns(q.resolve({}))
};
var collectionMock = {
  doc: sinon.stub().returns(refMock)
};
var firestoreMock = {
  settings: sinon.stub().returns(0),
  collection: sinon.stub().returns(collectionMock)
};
var firebaseMock = {
  firestore: sinon.stub().returns(firestoreMock),
  credential: { cert: sinon.stub().returns(0) },
  initializeApp: sinon.stub().returns(0)
};
let configFile = {
  localfile: '/tmp/nrp_activity.log',
  databaseURL: 'https://test-nrp-data-base.firebaseio.com' // fake
};

describe('ActivityLogger', function() {
  beforeEach(function() {
    refMock.set.reset();
    ActivityLoggerRewire.__set__('firebase', firebaseMock);
  });

  it('The constructor should call initializeFirebase depending on the app configuration', function() {
    var initializeFirebaseStub = sinon
      .stub(ActivityLogger.prototype, 'initializeFirebase')
      .returns(0); // May be called by the constructor below
    var al = new ActivityLogger(configFile);
    assert(al.initializeFirebase.called);
    initializeFirebaseStub.reset();
    al = new ActivityLogger({});
    assert(al.initializeFirebase.notCalled);
    ActivityLogger.prototype.initializeFirebase.restore();
  });

  it('logFirebase() should create an activity entry', function(done) {
    var al = new ActivityLogger(configFile);
    al.logFirebase('update', {})
      .then(function() {
        expect(refMock.set.callCount).to.equal(1);
        done();
      })
      .catch(function(error) {
        done(error);
      });
  });

  it('log() should log to local file and to Firebase firestore as required by the app configuration', function(done) {
    sinon.stub(ActivityLogger.prototype, 'logLocal').returns(q.resolve());
    sinon.stub(ActivityLogger.prototype, 'logFirebase').returns(q.resolve());
    var al = new ActivityLogger(configFile);
    expect(al.config).to.be.defined;
    expect(al.db).to.be.defined;
    al.log('update', {})
      .then(function() {
        expect(al.logLocal.called).to.equal(true);
        expect(al.logFirebase.called).to.equal(true);
        ActivityLogger.prototype.logLocal.restore();
        ActivityLogger.prototype.logFirebase.restore();
        done();
      })
      .catch(function(error) {
        done(error);
      });
  });

  it('log() should log to local file and not to Firebase firestore as required by the app configuration', function(done) {
    sinon.stub(ActivityLogger.prototype, 'logLocal').returns(q.resolve());
    sinon.stub(ActivityLogger.prototype, 'logFirebase').returns(q.resolve());
    var al = new ActivityLogger({ localfile: '/tmp/nrp_activity.log' });
    expect(al.config).to.be.defined;
    expect(al.db).to.be.undefined;
    al.log('update', {})
      .then(function() {
        expect(al.logLocal.called).to.equal(true);
        expect(al.logFirebase.called).to.equal(false);
        ActivityLogger.prototype.logLocal.restore();
        ActivityLogger.prototype.logFirebase.restore();
        done();
      })
      .catch(function(error) {
        done(error);
      });
  });
});
