export default class BamAdapter {
  constructor(config) {
    this.config = config
  }

  async hasDataForRefSeq({ assembly, refName }) {
    // TODO
  }

  async getFeaturesInRegion({ assembly, refName, start, end }) {
    // TODO
  }
}
