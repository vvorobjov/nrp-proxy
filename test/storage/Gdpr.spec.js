'use strict';

const chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  path = require('path');

chai.use(chaiAsPromised);

describe('GDPR', () => {
  let gdpr, DB;

  beforeEach(() => {
    const mockUtils = { storagePath: path.join(__dirname, 'dbMock') };
    DB = rewire('../../storage/FS/DB.js');
    DB.__set__('utils', mockUtils);
    const GDPR = rewire('../../storage/GDPR.js');
    GDPR.__set__('DB', DB);
    gdpr = new GDPR();
  });

  it(`should find nrpuser`, () => {
    return gdpr
      .getUserAcceptedGDPR('nrpuser')
      .should.eventually.deep.equal(true);
  });

  it(`should find not nrpuser2`, () => {
    return gdpr
      .getUserAcceptedGDPR('nrpuser2')
      .should.eventually.deep.equal(false);
  });

  it(`should insert new user`, () => {
    let collectionMock = sinon.stub();
    collectionMock.prototype.insert = sinon
      .stub()
      .returns(Promise.resolve('value'));
    DB.__set__('DBCollection', collectionMock);
    return gdpr
      .setUserAcceptedGDPR('nrpuser2')
      .should.eventually.deep.equal(true);
  });
});
