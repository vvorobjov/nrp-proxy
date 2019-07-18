class StorageRequestHandler {
  constructor() {}
  listExperimentsSharedByUsers() {
    return Promise.resolve([
      {
        id: 'experiment1',
        name: 'experiment1'
      }
    ]);
  }
}
module.exports = StorageRequestHandler;
