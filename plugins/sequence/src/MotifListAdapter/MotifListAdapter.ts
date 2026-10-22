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

interface MotifPass {
  motif: ParsedMotif
  motifIdx: number
  strand: 1 | 0 | -1
  siteLength: number
  // lookahead keeps overlapping hits: a site can start at every base
  re: RegExp
}

export default class MotifListAdapter extends ReferenceScanAdapter<MotifListAdapterConfig> {
  // the config is fixed for an adapter instance (dataAdapterCache), so this
  // parses and compiles a pasted REBASE set once, not on every block
  private passesCache?: MotifPass[]

  private get passes() {
    this.passesCache ??= this.buildPasses()
    return this.passesCache
  }

  private buildPasses() {
    const searchForward = this.getConf('searchForward')
    const searchReverse = this.getConf('searchReverse')
    const { motifs } = parseMotifList(this.getConf('motifs'))
    return motifs.flatMap((motif, motifIdx) => {
      const pass = (pattern: string, strand: 1 | 0 | -1): MotifPass => ({
        motif,
        motifIdx,
        strand,
        siteLength: pattern.length,
        re: new RegExp(`(?=(${iupacToRegex(pattern)}))`, 'gi'),
      })
      // a palindrome matches both strands at the same coordinates, so it is
      // scanned once, unstranded, whatever the strand flags say
      return isPalindromic(motif.site)
        ? [pass(motif.site, 0)]
        : [
            ...(searchForward ? [pass(motif.site, 1)] : []),
            ...(searchReverse
              ? [pass(reverseComplementIupac(motif.site), -1)]
              : []),
          ]
    })
  }

  protected scanPadding() {
    // a motif straddling the query edge is only found if its whole span was
    // fetched, so pad by the longest site
    return Math.max(0, ...this.passes.map(p => p.siteLength))
  }

  protected scan({ query, residues, windowStart, emit }: ScanWindow) {
    for (const { motif, motifIdx, strand, siteLength, re } of this.passes) {
      const { cutOffset: topOffset, site } = motif
      // '(n/m)' notation pins both cuts outright; a '^' pins only the top one,
      // whose mirror image is the bottom cut on a palindrome (strand 0) and
      // unknown on a stranded site
      const bottomOffset =
        motif.cutOffsetBottom ??
        (strand === 0 && topOffset !== undefined
          ? site.length - topOffset
          : undefined)
      for (const match of residues.matchAll(re)) {
        const start = windowStart + match.index
        const end = start + siteLength
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
  }
}
