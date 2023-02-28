class Storage {
  constructor() {}
  createOrUpdate() {
    return Promise.resolve([
      {
        experimentId: 'experiment1',
        name: 'experiment1'
      }
    ]);
  }
}
module.exports = Storage;
