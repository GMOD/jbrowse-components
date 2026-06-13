// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw

export default class ContactRecord {
  constructor(
    public bin1: number,
    public bin2: number,
    public counts: number,
  ) {}

  getKey() {
    return `${this.bin1}_${this.bin2}`
  }
}
