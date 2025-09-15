import { type Feature, max } from '@jbrowse/core/util'

import { getSOTermAndDescription } from './util'

import type VCFParser from '@gmod/vcf'
import type { Variant } from '@gmod/vcf'

type FeatureData = ReturnType<typeof dataFromVariant>

function dataFromVariant(variant: Variant, parser: VCFParser) {
  const { REF = '', ALT, POS, CHROM, ID } = variant
  const start = POS - 1
  const [type, description] = getSOTermAndDescription(REF, ALT, parser)

  return {
    refName: CHROM,
    start,
    end: getEnd(variant),
    description,
    type,
    name: ID?.join(','),
  }
}
function getEnd(variant: Variant) {
  const { POS, REF = '', ALT } = variant
  const isTRA = ALT?.includes('<TRA>')
  const start = POS - 1
  const isSymbolic = ALT?.some(f => f.includes('<'))
  if (isSymbolic) {
    const info = variant.INFO
    if (info.END && !isTRA) {
      return +(info.END as string[])[0]!
    }
    const lens = []
    if (info.SVLEN && !isTRA) {
      for (let i = 0; i < info.SVLEN.length; i++) {
        if (!ALT?.[i]?.startsWith('<INS')) {
          lens.push(Math.abs(+(info.SVLEN as string[])[i]!))
        } else {
          lens.push(1)
        }
      }
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

  get(field: string): any {
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

  toJSON(): any {
    const { SAMPLES, GENOTYPES, ...rest } = this.variant
    return {
      uniqueId: this._id,
      ...rest,
      ...this.data,
      samples: this.variant.SAMPLES(),
    }
  }
}
