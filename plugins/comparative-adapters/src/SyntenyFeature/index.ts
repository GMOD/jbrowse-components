import { SimpleFeature } from '@jbrowse/core/util'
import { MismatchParser } from '@jbrowse/plugin-alignments'

const { getMismatches } = MismatchParser

export default class SyntenyFeature extends SimpleFeature {
  get(arg: string): any {
    return arg === 'mismatches'
      ? getMismatches(this.get('CIGAR'))
      : super.get(arg)
  }
}
