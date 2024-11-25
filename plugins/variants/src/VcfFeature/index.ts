import { getSOTermAndDescription } from './util'
import type VCF from '@gmod/vcf'
import type { Feature } from '@jbrowse/core/util'

// locals

type Samples = Record<
  string,
  Record<string, { values: string[] | number[] | null }>
>

interface FeatureData {
  [key: string]: unknown
  refName: string
  start: number
  end: number
  description?: string
  type?: string
  name?: string
  aliases?: string[]
  samples?: Samples
}

export default class VCFFeature implements Feature {
  private variant: any

  private parser: VCF

  private data: FeatureData

  private _id: string

  constructor(args: { variant: any; parser: VCF; id: string }) {
    this.variant = args.variant
    this.parser = args.parser
    this.data = this.dataFromVariant(this.variant)
    this._id = args.id
  }

  get(field: string): any {
    return field === 'samples'
      ? this.variant.SAMPLES
      : (this.data[field] ?? this.variant[field])
  }

  set() {}

  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  tags() {
    return [...Object.keys(this.data), ...Object.keys(this.variant), 'samples']
  }

  id() {
    return this._id
  }

  dataFromVariant(variant: {
    REF: string
    POS: number
    ALT?: string[]
    CHROM: string
    INFO: any
    ID?: string[]
  }): FeatureData {
    const { REF, ALT, POS, CHROM, INFO, ID } = variant
    const start = POS - 1
    const [type, description] = getSOTermAndDescription(REF, ALT, this.parser)
    const isTRA = ALT?.includes('<TRA>')
    const isSymbolic = ALT?.some(f => f.includes('<'))

    return {
      refName: CHROM,
      start,
      end: isSymbolic && INFO.END && !isTRA ? +INFO.END[0] : start + REF.length,
      description,
      type,
      name: ID?.join(','),
      aliases: ID && ID.length > 1 ? ID.slice(1) : undefined,
    }
  }

  toJSON(): any {
    return {
      uniqueId: this._id,
      ...this.variant,
      ...this.data,
      samples: this.variant.SAMPLES,
    }
  }
}
