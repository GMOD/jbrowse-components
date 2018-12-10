export default class PrecomputedLayout {
  constructor(json) {
    this.data = json
  }

  addRect(id) {
    if (!(id in this.data)) {
      // debugger
      throw new Error(`id ${id} not found in precomputed feature layout`)
    }
    return this.data[id]
  }

  toJSON() {
    return this.data
  }
}
