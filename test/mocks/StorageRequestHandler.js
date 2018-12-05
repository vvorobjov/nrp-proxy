class StorageRequestHandler {
  constructor() {}
  listExperimentsSharedByUser() {
    return Promise.resolve([
      {
        id: 'experiment1',
        name: 'experiment1'
      }
    ]);
  }
}
module.exports = StorageRequestHandler;
