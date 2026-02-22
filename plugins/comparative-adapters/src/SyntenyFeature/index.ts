import { SimpleFeature } from '@jbrowse/core/util'
import { getMismatches } from '@jbrowse/plugin-alignments'

export default class SyntenyFeature extends SimpleFeature {
  get(arg: string): any {
    return arg === 'mismatches'
      ? getMismatches(this.get('CIGAR'))
      : super.get(arg)
  }
}
