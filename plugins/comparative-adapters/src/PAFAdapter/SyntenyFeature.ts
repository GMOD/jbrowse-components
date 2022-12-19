import { SimpleFeature } from '@jbrowse/core/util'
import { MismatchParser } from '@jbrowse/plugin-alignments'

// locals
const { getOrientedMismatches } = MismatchParser

export default class SyntenyFeature extends SimpleFeature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(arg: string): any {
    if (arg === 'mismatches') {
      const cg = this.get('CIGAR')
      const flip = this.get('flipInsDel')
      return cg ? getOrientedMismatches(flip, cg) : []
    }
    return super.get(arg)
  }
}
