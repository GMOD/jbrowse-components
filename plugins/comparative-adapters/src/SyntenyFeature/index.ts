import { getMismatches } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

export default class SyntenyFeature extends SimpleFeature {
  get(name: 'mismatches'): ReturnType<typeof getMismatches>
  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(name: string): unknown
  get(name: string): unknown {
    return name === 'mismatches'
      ? getMismatches(this.get('CIGAR') as string | undefined)
      : super.get(name)
  }
}
