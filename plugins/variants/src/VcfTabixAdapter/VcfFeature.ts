import { Feature } from '@jbrowse/core/util/simpleFeature'
import { parseBreakend } from '@gmod/vcf'

/* eslint-disable no-underscore-dangle */

/**
 * VCF Feature creation with lazy genotype evaluation.
 */
interface Samples {
  [key: string]: {
    [key: string]: { values: string[] | number[] | null };
  };
}

interface FeatureData {
  [key: string]: unknown;
  refName: string;
  start: number;
  end: number;
  description?: string;
  type?: string;
  name?: string;
  aliases?: string[];
  samples?: Samples;
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
    return field === 'samples'
      ? this.variant.SAMPLES
      : this.data[field] || this.variant[field]
  }

  set(): void {}

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

  dataFromVariant(variant: {
    REF: string;
    POS: number;
    ALT: string[];
    CHROM: string;
    INFO: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    ID: string[];
  }): FeatureData {
    const { REF, ALT, POS, CHROM, INFO, ID } = variant
    const start = POS - 1
    const [SO_term, description] = this._getSOTermAndDescription(REF, ALT)
    const isTRA = ALT?.some(f => f === '<TRA>')
    const isSymbolic = ALT?.some(f => f.indexOf('<') !== -1)

    return {
      refName: CHROM,
      start,
      end: isSymbolic && INFO.END && !isTRA ? +INFO.END[0] : start + REF.length,
      description,
      type: SO_term,
      name: ID?.join(','),
      aliases: ID && ID.length > 1 ? variant.ID.slice(1) : undefined,
    }
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

    const soTerms = new Set<string>()
    let descriptions = new Set<string>()
    alt.forEach(a => {
      let [soTerm, description] = this._getSOAndDescFromAltDefs(ref, a)

      if (!soTerm) {
        [soTerm, description] = this._getSOAndDescByExamination(ref, a)
      }
      if (soTerm && description) {
        soTerms.add(soTerm)
        descriptions.add(description)
      }
    })

    // Combine descriptions like ["SNV G -> A", "SNV G -> T"] to ["SNV G -> A,T"]
    if (descriptions.size > 1) {
      const prefixes = new Set(
        [...descriptions].map(desc => {
          const prefix = desc.split('->')
          return prefix[1] ? prefix[0] : desc
        }),
      )

      const new_descs = [...prefixes].map(prefix => {
        const suffixes = [...descriptions]
          .map(desc => {
            const pref = desc.split('-> ')
            return pref[1] && pref[0] === prefix ? pref[1] : ''
          })
          .filter(f => !!f)

        return suffixes.length
          ? prefix + '-> ' + suffixes.join(',')
          : [...descriptions].join(',')
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
    alt: string,
  ): [string, string] | [undefined, undefined] {
    if (typeof alt === 'string' && !alt.startsWith('<')) {
      return [undefined, undefined]
    }

    // look for a definition with an SO type for this
    let soTerm = VCFFeature._altTypeToSO[alt]
    // if no SO term but ALT is in metadata, assume sequence_variant
    if (!soTerm && this.parser.getMetadata('ALT', alt)) {
      soTerm = 'sequence_variant'
    }
    if (soTerm) {
      return [soTerm, alt]
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

  // note: term SNV is used instead of SNP because SO definition of SNP says
  // abundance must be at least 1% in population, and can't be sure we meet
  // that
  _getSOAndDescByExamination(ref: string, alt: string): [string, string] {
    const bnd = parseBreakend(alt)
    if (bnd) {
      return ['breakend', alt]
    } else if (ref.length === 1 && alt.length === 1) {
      return ['SNV', this._makeDescriptionString('SNV', ref, alt)]
    } else if (alt === '<INS>') {
      return ['insertion', alt]
    } else if (alt === '<DEL>') {
      return ['deletion', alt]
    } else if (alt === '<INV>') {
      return ['deletion', alt]
    } else if (alt === '<TRA>') {
      return ['translocation', alt]
    } else if (alt.includes('<')) {
      return ['sv', alt]
    } else if (ref.length === alt.length) {
      if (ref.split('').reverse().join('') === alt) {
        return ['inversion', this._makeDescriptionString('inversion', ref, alt)]
      }
      return [
        'substitution',
        this._makeDescriptionString('substitution', ref, alt),
      ]
    } else if (ref.length <= alt.length) {
      return ['insertion', this._makeDescriptionString('insertion', ref, alt)]
    } else if (ref.length > alt.length) {
      return ['deletion', this._makeDescriptionString('deletion', ref, alt)]
    }

    return ['indel', this._makeDescriptionString('indel', ref, alt)]
  }

  _makeDescriptionString(soTerm: string, ref: string, alt: string): string {
    return `${soTerm} ${ref} -> ${alt}`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return {
      uniqueId: this._id,
      ...this.variant,
      ...this.data,
      samples: this.variant.SAMPLES,
    }
  }
}
