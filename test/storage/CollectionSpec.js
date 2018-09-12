'use strict';

const chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  chaiSubset = require('chai-subset'),
  rewire = require('rewire'),
  expect = chai.expect,
  sinon = require('sinon');

let RewiredCollection = rewire('../../storage/FS/Collection.js');
var tingodbMock = sinon.stub();
const fakeResult = 'a1fdb0e8-04bb-4a32-9a26-e20dba8a2a24',
  fakeEntry = { uuid: 'fakeUuid' };

tingodbMock.prototype.insert = sinon
  .stub()
  .returns(Promise.resolve(fakeResult));
tingodbMock.prototype.findOne = sinon
  .stub()
  .returns(Promise.resolve(fakeResult));
tingodbMock.prototype.find = sinon.stub().returns(Promise.resolve(fakeResult));
tingodbMock.prototype.update = sinon
  .stub()
  .returns(Promise.resolve(fakeResult));

var collection = new RewiredCollection(tingodbMock);
chai.use(chaiAsPromised);
chai.use(chaiSubset);
chai.should();

describe('Collection ', () => {
  it(`should insert into the DB`, () => {
    collection.insert(fakeEntry).then(res => expect(res).should.not.be.empty);
  });
  it(`should findOne into the DB`, () => {
    collection.findOne(fakeEntry).then(res => expect(res).should.not.be.empty);
  });
  it(`should find into the DB`, () => {
    collection.find(fakeEntry).then(res => expect(res).should.not.be.empty);
  });
  it(`should Update entry of the DB the DB`, () => {
    collection.update(fakeEntry).then(res => expect(res).should.not.be.empty);
  });
  it(`should Remove entry of the DB`, () => {
    collection.remove(fakeEntry).then(res => expect(res).should.not.be.empty);
  });
});
