export default class PrecomputedLayout {
  constructor({ records, totalHeight }) {
    this.records = records
    this.totalHeight = totalHeight
  }

  addRect(id) {
    if (!(id in this.records)) {
      // debugger
      throw new Error(`id ${id} not found in precomputed feature layout`)
    }
    return this.records[id]
  }

  toJSON() {
    return { records: this.records, totalHeight: this.totalHeight }
  }
}
