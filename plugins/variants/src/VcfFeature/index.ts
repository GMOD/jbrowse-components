import { getEnd, getSOTermAndDescription } from './util.ts'

import type VCFParser from '@gmod/vcf'
import type { FormatFieldsCallback, GenotypeCallback, Variant } from '@gmod/vcf'
import type { Feature } from '@jbrowse/core/util'

type FeatureData = ReturnType<typeof dataFromVariant>

function dataFromVariant(variant: Variant, parser: VCFParser) {
  const { REF = '', ALT, POS, CHROM, ID, INFO } = variant
  const start = POS - 1
  const [type, description] = getSOTermAndDescription(REF, ALT, parser, INFO)

  if (CHROM === undefined) {
    throw new Error('VCF record has no CHROM')
  }

  return {
    refName: CHROM,
    start,
    end: getEnd(variant, start),
    description,
    type,
    name: ID?.join(','),
  }
}

export default class VCFFeature implements Feature {
  private variant: Variant

  private parser: VCFParser

  private data: FeatureData

  private _id: string

  constructor(args: { variant: Variant; parser: VCFParser; id: string }) {
    this.variant = args.variant
    this.parser = args.parser
    this.data = dataFromVariant(this.variant, this.parser)
    this._id = args.id
  }

  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source' | 'REF'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score' | 'QUAL'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(field: 'ALT'): string[] | undefined
  get(field: 'FILTER'): string | string[] | undefined
  get(field: 'INFO'): Record<string, unknown>
  get(field: 'genotypes'): Record<string, string>
  get(field: 'samples'): ReturnType<Variant['SAMPLES']>
  get(field: string): unknown
  get(field: string): unknown {
    return field === 'samples'
      ? this.variant.SAMPLES()
      : field === 'genotypes'
        ? this.variant.GENOTYPES()
        : (this.data[field as keyof typeof this.data] ??
          this.variant[field as keyof typeof this.variant])
  }
  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  id() {
    return this._id
  }

  processGenotypes(callback: GenotypeCallback) {
    this.variant.processGenotypes(callback)
  }

  processFormatFields(keys: string[], callback: FormatFieldsCallback) {
    this.variant.processFormatFields(keys, callback)
  }

  toJSON() {
    return {
      uniqueId: this._id,
      ...this.variant.toJSON(),
      ...this.data,
      samples: this.variant.SAMPLES(),
    }
  }
}
