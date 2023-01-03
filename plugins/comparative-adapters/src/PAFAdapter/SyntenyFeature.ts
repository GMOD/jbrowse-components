import { SimpleFeature } from '@jbrowse/core/util'
import { MismatchParser } from '@jbrowse/plugin-alignments'

// locals
const { getMismatches } = MismatchParser

export default class SyntenyFeature extends SimpleFeature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(arg: string): any {
    if (arg === 'mismatches') {
      return getMismatches(this.get('CIGAR'))
    }
    return super.get(arg)
  }
}
