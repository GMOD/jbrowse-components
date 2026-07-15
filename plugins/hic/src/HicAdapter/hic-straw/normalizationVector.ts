// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw

import BinaryParser from './binary.ts'

import type { Filehandle } from './types.ts'

const DOUBLE = 8

export default class NormalizationVector {
  private cache: { start: number; end: number; values: number[] } | undefined

  constructor(
    private file: Filehandle,
    private filePosition: number,
    private nValues: number,
    private dataType: number,
  ) {}

  async getValues(start: number, end: number) {
    if (!this.cache || start < this.cache.start || end > this.cache.end) {
      const adjustedStart = Math.max(0, start - 1000)
      const adjustedEnd = Math.min(this.nValues, end + 1000)
      const startPosition = this.filePosition + adjustedStart * this.dataType
      const n = adjustedEnd - adjustedStart
      const data = await this.file.read(startPosition, n * this.dataType)
      const parser = new BinaryParser(new DataView(data))
      const values: number[] = []
      for (let i = 0; i < n; i++) {
        values[i] =
          this.dataType === DOUBLE ? parser.getDouble() : parser.getFloat()
      }
      this.cache = { start: adjustedStart, end: adjustedEnd, values }
    }

    const sliceStart = start - this.cache.start
    return this.cache.values.slice(sliceStart, sliceStart + (end - start))
  }
}
