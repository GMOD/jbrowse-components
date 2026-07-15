import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  SimpleFeature,
  doesIntersect2,
  isPalindromic,
  iupacToRegex,
  parseMotifList,
  reverseComplementIupac,
} from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { MotifListAdapterConfig } from './configSchema.ts'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, ParsedMotif, Region } from '@jbrowse/core/util'

// Describes the double-strand break implied by a palindromic site's cut offset:
// the two cuts are mirror images, so their separation is the overhang.
function describeEnds(overhang: number) {
  return overhang === 0
    ? 'blunt'
    : `${overhang > 0 ? "5'" : "3'"} overhang (${Math.abs(overhang)} bp)`
}

export default class MotifListAdapter extends BaseFeatureDataAdapter<MotifListAdapterConfig> {
  public async configure() {
    const adapter = await this.getSubAdapter?.(this.getConf('sequenceAdapter'))
    if (!adapter) {
      throw new Error('Error getting subadapter')
    }
    return adapter.dataAdapter as BaseSequenceAdapter
  }

  public async getRefNames() {
    const adapter = await this.configure()
    return adapter.getRefNames()
  }

  public getFeatures(query: Region, opts: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      const sequenceAdapter = await this.configure()
      const searchForward = this.getConf('searchForward')
      const searchReverse = this.getConf('searchReverse')
      const { motifs } = parseMotifList(this.getConf('motifs'))

      // a motif straddling the query edge is only found if its whole span was
      // fetched, so pad by the longest site
      const pad = Math.max(0, ...motifs.map(m => m.site.length))
      const queryStart = Math.max(0, query.start - pad)
      const residues =
        (await sequenceAdapter.getSequence(
          { ...query, start: queryStart, end: query.end + pad },
          opts,
        )) ?? ''

      const emit = (
        motif: ParsedMotif,
        motifIdx: number,
        pattern: string,
        strand: 1 | 0 | -1,
      ) => {
        const { cutOffset } = motif
        // lookahead keeps overlapping hits: a site can start at every base
        const re = new RegExp(`(?=(${iupacToRegex(pattern)}))`, 'gi')
        for (const match of residues.matchAll(re)) {
          const start = queryStart + match.index
          const end = start + pattern.length
          if (doesIntersect2(start, end, query.start, query.end)) {
            // the cut sits cutOffset bp from the site's 5' end, which is the
            // high-coordinate end when the site was matched revcomp'd
            const cutSite =
              cutOffset === undefined
                ? undefined
                : strand === -1
                  ? end - cutOffset
                  : start + cutOffset
            // only a palindrome's notation pins the bottom-strand cut too: it
            // mirrors the top cut, so the two together give the overhang
            const bottomCut =
              cutOffset === undefined || strand !== 0
                ? undefined
                : end - cutOffset
            observer.next(
              new SimpleFeature({
                uniqueId: `${this.id}-${motifIdx}-${start}-${strand}`,
                refName: query.refName,
                start,
                end,
                strand,
                name: motif.name,
                type: 'motif',
                site: motif.site,
                ...(cutSite === undefined ? {} : { cutSite }),
                ...(bottomCut === undefined || cutSite === undefined
                  ? {}
                  : {
                      cutSiteBottom: bottomCut,
                      ends: describeEnds(bottomCut - cutSite),
                    }),
              }),
            )
          }
        }
      }

      for (const [motifIdx, motif] of motifs.entries()) {
        const { site } = motif
        if (isPalindromic(site)) {
          // a palindrome matches both strands at the same coordinates, so
          // scanning each strand would double every hit; emit it once, unstranded
          if (searchForward || searchReverse) {
            emit(motif, motifIdx, site, 0)
          }
        } else {
          if (searchForward) {
            emit(motif, motifIdx, site, 1)
          }
          if (searchReverse) {
            emit(motif, motifIdx, reverseComplementIupac(site), -1)
          }
        }
      }
      observer.complete()
    })
  }
}
