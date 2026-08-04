import {
  isPalindromic,
  iupacToRegex,
  parseMotifList,
  reverseComplementIupac,
} from '@jbrowse/core/util'

import { ReferenceScanAdapter } from '../ReferenceScanAdapter.ts'

import type { ScanWindow } from '../ReferenceScanAdapter.ts'
import type { MotifListAdapterConfig } from './configSchema.ts'
import type { ParsedMotif } from '@jbrowse/core/util'

// Describes the double-strand break implied by the two cut offsets: their
// separation is the overhang. Stated in offsets rather than coordinates so it
// reads the same whichever strand the site was matched on.
function describeEnds(overhang: number) {
  return overhang === 0
    ? 'blunt'
    : `${overhang > 0 ? "5'" : "3'"} overhang (${Math.abs(overhang)} bp)`
}

export default class MotifListAdapter extends ReferenceScanAdapter<MotifListAdapterConfig> {
  // the list is a config string parsed identically for every block, and an
  // adapter instance is cached per config (dataAdapterCache), so parsing it and
  // compiling its regexes once per instance rather than once per block matters
  // for a pasted REBASE set of a few hundred enzymes
  private motifsCache?: ParsedMotif[]

  private get motifs() {
    this.motifsCache ??= parseMotifList(this.getConf('motifs')).motifs
    return this.motifsCache
  }

  protected scanPadding() {
    // a motif straddling the query edge is only found if its whole span was
    // fetched, so pad by the longest site
    return Math.max(0, ...this.motifs.map(m => m.site.length))
  }

  protected scan({ query, residues, windowStart, emit }: ScanWindow) {
    const searchForward = this.getConf('searchForward')
    const searchReverse = this.getConf('searchReverse')

    const emitMotif = (
      motif: ParsedMotif,
      motifIdx: number,
      pattern: string,
      strand: 1 | 0 | -1,
    ) => {
      const { cutOffset: topOffset, site } = motif
      // '(n/m)' notation pins both cuts outright; a '^' pins only the top one,
      // whose mirror image is the bottom cut on a palindrome (strand 0) and
      // unknown on a stranded site
      const bottomOffset =
        motif.cutOffsetBottom ??
        (strand === 0 && topOffset !== undefined
          ? site.length - topOffset
          : undefined)
      // lookahead keeps overlapping hits: a site can start at every base
      const re = new RegExp(`(?=(${iupacToRegex(pattern)}))`, 'gi')
      for (const match of residues.matchAll(re)) {
        const start = windowStart + match.index
        const end = start + pattern.length
        // offsets are measured from the site's 5' end, which is the
        // high-coordinate end when the site was matched revcomp'd. A type IIS
        // offset runs past the site, landing the cut outside [start, end).
        const at = (offset: number) =>
          strand === -1 ? end - offset : start + offset
        const cutSite = topOffset === undefined ? undefined : at(topOffset)
        const cutSiteBottom =
          bottomOffset === undefined ? undefined : at(bottomOffset)
        emit({
          uniqueId: `${this.id}-${motifIdx}-${start}-${strand}`,
          refName: query.refName,
          start,
          end,
          strand,
          name: motif.name,
          type: 'motif',
          site,
          ...(cutSite === undefined ? {} : { cutSite }),
          ...(cutSiteBottom === undefined ? {} : { cutSiteBottom }),
          ...(topOffset === undefined || bottomOffset === undefined
            ? {}
            : { ends: describeEnds(bottomOffset - topOffset) }),
        })
      }
    }

    for (const [motifIdx, motif] of this.motifs.entries()) {
      const { site } = motif
      if (isPalindromic(site)) {
        // a palindrome matches both strands at the same coordinates, so scanning
        // each strand would double every hit; emit it once, unstranded,
        // regardless of the strand flags — there is no strand to choose between
        // (which is what the config slots' docs promise)
        emitMotif(motif, motifIdx, site, 0)
      } else {
        if (searchForward) {
          emitMotif(motif, motifIdx, site, 1)
        }
        if (searchReverse) {
          emitMotif(motif, motifIdx, reverseComplementIupac(site), -1)
        }
      }
    }
  }
}
