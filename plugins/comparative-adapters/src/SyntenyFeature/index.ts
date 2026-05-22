import { getMismatches } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

export default class SyntenyFeature extends SimpleFeature {
  get(arg: string): any {
    return arg === 'mismatches'
      ? getMismatches(this.get('CIGAR'))
      : super.get(arg)
  }
}
