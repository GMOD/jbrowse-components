// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw

import HicFile from './hicFile.ts'

import type { HicConfig } from './hicFile.ts'
import type { HicRegion } from './types.ts'

export default class Straw {
  private hicFile: HicFile

  constructor(config: HicConfig) {
    this.hicFile = new HicFile(config)
  }

  async getMetaData() {
    return this.hicFile.getMetaData()
  }

  async getContactRecords(
    normalization: string,
    region1: HicRegion,
    region2: HicRegion,
    units: string,
    binsize: number,
  ) {
    return this.hicFile.getContactRecords(
      normalization,
      region1,
      region2,
      units,
      binsize,
    )
  }

  async getNormalizationOptions() {
    return this.hicFile.getNormalizationOptions()
  }

  getFileChrName(chrAlias: string) {
    return this.hicFile.getFileChrName(chrAlias)
  }
}
