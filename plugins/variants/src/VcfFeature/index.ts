import { type Feature, max } from '@jbrowse/core/util'

import { getSOTermAndDescription } from './util.ts'

import type VCFParser from '@gmod/vcf'
import type { GenotypeCallback, Variant } from '@gmod/vcf'

type FeatureData = ReturnType<typeof dataFromVariant>

function dataFromVariant(variant: Variant, parser: VCFParser) {
  const { REF = '', ALT, POS, CHROM, ID, INFO } = variant
  const start = POS - 1
  const [type, description] = getSOTermAndDescription(REF, ALT, parser, INFO)

  return {
    refName: CHROM!,
    start,
    end: getEnd(variant),
    description,
    type,
    name: ID?.join(','),
  }
}
function getEnd(variant: Variant) {
  const { POS, REF = '', ALT = [], INFO } = variant
  const start = POS - 1
  const hasSymbolic = ALT.some(a => a.startsWith('<'))
  const hasTRA = ALT.includes('<TRA>')
  if (hasSymbolic && !hasTRA) {
    if (Array.isArray(INFO.END)) {
      const end = INFO.END[0]
      if (end !== undefined) {
        return +end
      }
    }
    if (Array.isArray(INFO.SVLEN)) {
      const lens = INFO.SVLEN.map((len, i) =>
        ALT[i]?.startsWith('<INS') ? 1 : Math.abs(+(len ?? 0)),
      )
      return start + max(lens)
    }
  }
  return start + REF.length
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

  toJSON() {
    return {
      uniqueId: this._id,
      ...this.variant.toJSON(),
      ...this.data,
      samples: this.variant.SAMPLES(),
    }
  }
}
