import { getMismatches } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

export default class SyntenyFeature extends SimpleFeature {
  get(name: 'mismatches'): ReturnType<typeof getMismatches>
  get(name: string): any
  get(name: string): any {
    return name === 'mismatches'
      ? getMismatches(this.get('CIGAR') as string | undefined)
      : super.get(name)
  }
}
