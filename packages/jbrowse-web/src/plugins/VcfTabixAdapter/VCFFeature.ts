import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

/* eslint-disable no-underscore-dangle, @typescript-eslint/camelcase */

/**
 * VCF Feature creation with lazy genotpye evaluation.
 */
interface Genotypes {
  [key: string]: { [key: string]: { values: string[] } }
}
interface FeatureData {
  start: number
  end: number
  refName: string
  description?: string
  type?: string
  reference_allele: string
  name?: string
  score: number
  filters: string[]
  aliases: string[]
  alternative_alleles: string[]
  genotypes?: Genotypes
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
    return this._get(field) || this._get(field.toLowerCase())
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(name: string, val: any): void {}

  // same as get(), except requires lower-case arguments.    used
  // internally to save lots of calls to field.toLowerCase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _get(field: string): any {
    if (field in this.data) {
      // @ts-ignore
      return this.data[field] // have we already parsed it out?
    }
    if (field === 'genotypes') {
      this.data[field] = this._parse_genotypes()
      return this.data[field] // have we already parsed it out?
    }
    return undefined
  }

  parent(): undefined {
    return undefined
  }

  children(): undefined {
    return undefined
  }

  tags(): string[] {
    const t = Object.keys(this.data)
    if (!this.data.genotypes) t.push('genotypes')
    return t
  }

  id(): string {
    return this._id
  }

  _parse_genotypes(): Genotypes {
    const { variant } = this
    delete this.variant // TODO: remove this delete if we add other laziness

    const genotypes: Genotypes = {}
    if (Object.keys(variant.SAMPLES).length) {
      Object.keys(variant.SAMPLES).forEach((sample: string) => {
        genotypes[sample] = {}
        Object.keys(variant.SAMPLES[sample]).forEach((field: string) => {
          genotypes[sample][field] = {
            values: variant.SAMPLES[sample][field],
          }
        })
      })
      return genotypes
    }
    return genotypes
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataFromVariant(variant: any): FeatureData {
    const start = variant.POS - 1
    const [SO_term, description] = this._getSOTermAndDescription(
      variant.REF,
      variant.ALT,
    )

    const featureData: FeatureData = {
      start,
      end: variant.INFO.END
        ? Number(variant.INFO.END[0])
        : start + variant.REF.length,
      refName: variant.CHROM,
      description,
      type: SO_term,
      reference_allele: variant.REF,
      name: variant.ID ? variant.ID[0] : undefined,
      aliases:
        variant.ID && variant.ID.length > 1 ? variant.ID.slice(1) : undefined,
      score: variant.QUAL,
      filters: variant.FILTER === 'PASS' ? ['PASS'] : variant.FILTER,
      alternative_alleles: variant.ALT,
    }

    // parse the info field and store its contents as attributes in featureData
    if (variant.INFO) {
      this._parseInfoField(featureData, variant.INFO)
    }

    return featureData
  }

  /**
   * parse a VCF line's INFO field, storing the contents as
   * attributes in featureData
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _parseInfoField(featureData: FeatureData, info: Record<string, any>): void {
    // decorate the info records with references to their descriptions
    Object.entries(info).forEach(([field, value]) => {
      info[field] = {
        values: value,
      }
      const meta = this.parser.getMetadata('INFO', field)
      if (meta) info[field].meta = meta
      // @ts-ignore
      featureData[field] = info[field]
    })
  }

  /**
   * Get a sequence ontology (SO) term that describes the variant type
   */
  _getSOTermAndDescription(
    ref: string,
    alt: string[],
  ): [string | undefined, string | undefined] {
    // it's just a remark if there are no alternate alleles
    if (!alt || alt === []) {
      return ['remark', 'no alternative alleles']
    }

    const soTerms = new Set()
    let descriptions = new Set()
    alt.forEach(a => {
      let [soTerm, description] = this._getSOAndDescFromAltDefs(ref, a)
      if (!soTerm) {
        ;[soTerm, description] = this._getSOAndDescByExamination(ref, a)
      }
      if (soTerm) {
        soTerms.add(soTerm)
        descriptions.add(description)
      }
    })
    // Combine descriptions like ["SNV G -> A", "SNV G -> T"] to ["SNV G -> A,T"]
    if (descriptions.size > 1) {
      const prefixes = new Set()
      ;[...descriptions].forEach(desc => {
        const prefix = desc.match(/(\w+? \w+? -> )(?:<)\w+(?:>)/)
        if (prefix && prefix[1]) prefixes.add(prefix[1])
        else prefixes.add(desc)
      })
      const new_descs: string[] = []
      ;[...prefixes].forEach(prefix => {
        const suffixes: string[] = []
        ;[...descriptions].forEach(desc => {
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
    DUP: 'copy_number_gain',
    INV: 'inversion',
    CNV: 'copy_number_variation',
    'DUP:TANDEM': 'copy_number_gain',
    NON_REF: 'sequence_variant',
    '*': 'sequence_variant',
  }

  _getSOAndDescFromAltDefs(
    ref: string,
    alt: string,
  ): [string | undefined, string | undefined] {
    // not a symbolic ALT if doesn't begin with '<', so we'll have no definition
    if (alt[0] !== '<') {
      return [undefined, undefined]
    }

    alt = alt.replace(/^<|>$/g, '') // trim off < and >

    // look for a definition with an SO type for this
    let soTerm = VCFFeature._altTypeToSO[alt] as string | undefined
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

  _getSOAndDescByExamination(ref: string, alt: string): [string, string] {
    if (ref.length === 1 && alt.length === 1) {
      // use SNV because SO definition of SNP says abundance must be at
      // least 1% in population, and can't be sure we meet that
      return ['SNV', this._makeDescriptionString('SNV', ref, alt)]
    }

    if (ref.length === alt.length)
      if (
        ref
          .split('')
          .reverse()
          .join('') === alt
      )
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

  _makeDescriptionString(soTerm: string, ref: string, alt: string): string {
    return `${soTerm} ${ref} -> ${alt}`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return { uniqueId: this._id, ...this.data }
  }
}
