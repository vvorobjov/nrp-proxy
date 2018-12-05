class Storage {
  constructor() {}
  createOrUpdate() {
    return Promise.resolve([
      {
        id: 'experiment1',
        name: 'experiment1'
      }
    ]);
  }
}
module.exports = Storage;
