class templateExperimentService {
  constructor() {}
  loadSharedExperiments() {
    return Promise.resolve([
      {
        experimentId: 'test1',
        name: 'test1'
      }
    ]);
  }
  loadExperiments() {
    return Promise.resolve();
  }
  getExperimentFilePath() {
    return 'experiment1/test.png';
  }
}
module.exports = templateExperimentService;
