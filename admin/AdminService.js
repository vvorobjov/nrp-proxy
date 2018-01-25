const q = require('q'),
  configurationManager = require('../utils/configurationManager.js');

class AdminService {
  getStatus() {
    return q.resolve({
      maintenance: configurationManager.getState('maintenance') || false
    });
  }

  setStatus(maintenance) {
    configurationManager.setState('maintenance', maintenance);
    return q.resolve();
  }
}
module.exports = AdminService;
