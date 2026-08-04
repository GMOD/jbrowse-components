import { isPalindromic, revcom } from '@jbrowse/core/util'

import { ReferenceScanAdapter } from '../ReferenceScanAdapter.ts'

import type { ScanWindow } from '../ReferenceScanAdapter.ts'
import type { SequenceSearchAdapterConfig } from './configSchema.ts'

// The search is a regex, so there is no bound on how long a match can be. This
// is the assumed worst case: a hit reaching further than this past the query
// edge is found by the neighbouring block instead of here.
const SEARCH_PADDING_BP = 10_000

export default class SequenceSearchAdapter extends ReferenceScanAdapter<SequenceSearchAdapterConfig> {
  protected scanPadding() {
    return SEARCH_PADDING_BP
  }

  protected scan({
    query,
    residues,
    windowStart,
    windowEnd,
    emit,
  }: ScanWindow) {
    const search = this.getConf('search')
    if (!search) {
      return
    }
    const searchForward = this.getConf('searchForward')
    const searchReverse = this.getConf('searchReverse')
    const caseInsensitive = this.getConf('caseInsensitive')
    const re = new RegExp(search, `g${caseInsensitive ? 'i' : ''}`)
    // A plain palindromic sequence — a restriction-style site like GAATTC —
    // matches both strands at the same coordinates, so scanning each would
    // report every hit twice; emit it once, unstranded. Only decidable for a
    // bare ACGT sequence: the search is a regex, and a regex has no reverse
    // complement (nor do IUPAC codes mean anything to it).
    const palindromic =
      searchForward &&
      searchReverse &&
      /^[ACGT]+$/i.test(search) &&
      isPalindromic(search)

    if (searchForward) {
      for (const match of residues.matchAll(re)) {
        const start = windowStart + match.index
        emit({
          uniqueId: `${this.id}-${start}-${match[0]}-pos`,
          refName: query.refName,
          start,
          end: start + match[0].length,
          name: match[0],
          strand: palindromic ? 0 : 1,
        })
      }
    }
    if (searchReverse && !palindromic) {
      // index i of the reverse complement is the base at windowEnd-1-i, so a
      // match there runs leftward from windowEnd
      for (const match of revcom(residues).matchAll(re)) {
        const end = windowEnd - match.index
        emit({
          uniqueId: `${this.id}-${end - match[0].length}-${match[0]}-neg`,
          refName: query.refName,
          start: end - match[0].length,
          end,
          name: match[0],
          strand: -1,
        })
      }
    }
  }
}
