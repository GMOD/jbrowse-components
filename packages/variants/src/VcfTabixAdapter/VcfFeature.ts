import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

/* eslint-disable no-underscore-dangle, @typescript-eslint/camelcase */

/**
 * VCF Feature creation with lazy genotpye evaluation.
 */
interface Samples {
  [key: string]: {
    [key: string]: { values: string[] | number[] | null }
  }
}
interface Breakend {
  MateDirection: string
  Replacement: string
  MatePosition: string
  Join: string
}
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private variant: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parser: any

  private data: FeatureData

  private _id: string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(args: { variant: any; parser: any; id: string }) {
    this.variant = args.variant
    this.parser = args.parser
    this.data = this.dataFromVariant(this.variant)
    this._id = args.id
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(field: string): any {
    if (field === 'samples') return this.variant.SAMPLES
    return this.variant[field] || this.data[field]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(name: string, val: any): void {}

  parent(): undefined {
    return undefined
  }

  children(): undefined {
    return undefined
  }

  tags(): string[] {
    const t = [
      ...Object.keys(this.data),
      ...Object.keys(this.variant),
      'samples',
    ]
    return t
  }

  id(): string {
    return this._id
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataFromVariant(variant: any): FeatureData {
    const start = variant.POS - 1
    const [SO_term, description] = this._getSOTermAndDescription(
      variant.REF,
      variant.ALT,
    )
    const isTRA = variant.ALT.some((f: string) => f === '<TRA>')
    const featureData: FeatureData = {
      refName: variant.CHROM,
      start,
      end:
        variant.INFO.END && !isTRA
          ? Number(variant.INFO.END[0])
          : start + variant.REF.length,
      description,
      type: SO_term,
      name: variant.ID ? variant.ID[0] : undefined,
      aliases:
        variant.ID && variant.ID.length > 1 ? variant.ID.slice(1) : undefined,
    }

    return featureData
  }

  /**
   * Get a sequence ontology (SO) term that describes the variant type
   */
  _getSOTermAndDescription(
    ref: string,
    alt: string[],
  ): [string, string] | [undefined, undefined] {
    // it's just a remark if there are no alternate alleles
    if (!alt || alt === []) {
      return ['remark', 'no alternative alleles']
    }

    const soTerms: Set<string> = new Set()
    let descriptions: Set<string> = new Set()
    alt.forEach(a => {
      let [soTerm, description] = this._getSOAndDescFromAltDefs(ref, a)
      if (!soTerm) {
        ;[soTerm, description] = this._getSOAndDescByExamination(ref, a)
      }
      if (soTerm && description) {
        soTerms.add(soTerm)
        descriptions.add(description)
      }
    })
    // Combine descriptions like ["SNV G -> A", "SNV G -> T"] to ["SNV G -> A,T"]
    if (descriptions.size > 1) {
      const prefixes: Set<string> = new Set()
      descriptions.forEach(desc => {
        const prefix = /(\w+? \w+? -> )(?:<)\w+(?:>)/.exec(desc)
        if (prefix && prefix[1]) prefixes.add(prefix[1])
        else prefixes.add(desc)
      })
      const new_descs: string[] = []
      ;[...prefixes].forEach((prefix: string) => {
        const suffixes: string[] = []
        ;[...descriptions].forEach((desc: string) => {
          if (desc.startsWith(prefix)) {
            suffixes.push(desc.slice(prefix.length))
          }
        })
        new_descs.push(prefix + suffixes.join(','))
      })
      descriptions = new Set(new_descs)
    }
    if (soTerms.size) {
      return [[...soTerms].join(','), [...descriptions].join(',')]
    }
    return [undefined, undefined]
  }

  static _altTypeToSO: { [key: string]: string | undefined } = {
    DEL: 'deletion',
    INS: 'insertion',
    DUP: 'duplication',
    INV: 'inversion',
    INVDUP: 'inverted duplication',
    CNV: 'copy_number_variation',
    TRA: 'translocation',
    'DUP:TANDEM': 'tandem_duplication',
    NON_REF: 'sequence_variant',
    '*': 'sequence_variant',
  }

  _getSOAndDescFromAltDefs(
    ref: string,
    alt: string | Breakend,
  ): [string, string] | [undefined, undefined] {
    // not a symbolic ALT if doesn't begin with '<', so we'll have no definition
    if (typeof alt === 'object') {
      return [
        'breakend',
        'A VCF breakend defines one end of a point of structural variation',
      ]
    }

    if (typeof alt === 'string' && !alt.startsWith('<')) {
      return [undefined, undefined]
    }

    alt = alt.replace(/^<|>$/g, '') // trim off < and >

    // look for a definition with an SO type for this
    let soTerm = VCFFeature._altTypeToSO[alt]
    // if no SO term but ALT is in metadata, assume sequence_variant
    if (!soTerm && this.parser.getMetadata('ALT', alt))
      soTerm = 'sequence_variant'
    if (soTerm) {
      const description = this.parser.getMetadata('ALT', alt, 'Description')
        ? `${alt} - ${this.parser.getMetadata('ALT', alt, 'Description')}`
        : this._makeDescriptionString(soTerm, ref, alt)
      return [soTerm, description]
    }

    // try to look for a definition for a parent term if we can
    const modAlt = alt.split(':')
    if (modAlt.length > 1) {
      return this._getSOAndDescFromAltDefs(
        ref,
        `<${modAlt.slice(0, modAlt.length - 1).join(':')}>`,
      )
    }
    // no parent
    return [undefined, undefined]
  }

  _getSOAndDescByExamination(
    ref: string,
    alt: string | Breakend,
  ): [string, string] {
    if (typeof alt === 'object') {
      return ['breakend', this._makeDescriptionString('breakend', ref, alt)]
    }
    if (ref.length === 1 && alt.length === 1) {
      // use SNV because SO definition of SNP says abundance must be at
      // least 1% in population, and can't be sure we meet that
      return ['SNV', this._makeDescriptionString('SNV', ref, alt)]
    }
    if (ref.length === alt.length)
      if (ref.split('').reverse().join('') === alt)
        return ['inversion', this._makeDescriptionString('inversion', ref, alt)]
      else
        return [
          'substitution',
          this._makeDescriptionString('substitution', ref, alt),
        ]

    if (ref.length <= alt.length)
      return ['insertion', this._makeDescriptionString('insertion', ref, alt)]

    if (ref.length > alt.length)
      return ['deletion', this._makeDescriptionString('deletion', ref, alt)]

    return ['indel', this._makeDescriptionString('indel', ref, alt)]
  }

  _makeDescriptionString(
    soTerm: string,
    ref: string,
    alt: string | Breakend,
  ): string {
    return `${soTerm} ${ref} -> ${alt}`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return {
      uniqueId: this._id,
      ...this.data,
      ...this.variant,
      samples: this.variant.SAMPLES,
    }
  }
}
