class StorageRequestHandler {
  constructor() {}
  listExperimentsSharedByUsers() {
    return Promise.resolve([
      {
        experimentId: 'experiment1',
        name: 'experiment1'
      }
    ]);
  }
}
module.exports = StorageRequestHandler;
