'use strict';

const rewire = require('rewire'),
  q = require('q'),
  chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon');

let loggerManager = rewire('../../utils/loggerManager.js');

describe('Logger Manager', () => {
  it('should throw when unsuccessful', async () => {
    var logSpy = sinon.spy();
    loggerManager.__set__({
      console: {
        log: logSpy
      }
    });
    let appendFile = () => q.reject('Fake error');
    const mockFs = {
      appendFile: appendFile
    };
    loggerManager.__set__('fs', mockFs);
    var res = await loggerManager.log('manos');
    // we catch the error from propagating cause we don't
    // want the response to be broken if we cannot log
    expect(res).to.equal(undefined);
    sinon.assert.calledWith(logSpy, 'Fake error');
  });
});
