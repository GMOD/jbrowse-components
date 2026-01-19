import {
  getSession,
  isSessionModelWithWidgets,
  localStorageGetItem,
  localStorageSetItem,
} from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types, flow, Instance } from '@jbrowse/mobx-state-tree'

import {
  queryBlat,
  queryIsPcr,
  calculateScore,
  calculateIdentity,
  calculateQueryCoverage,
} from '../util/blatQuery.ts'

import type { BlatResult, IsPcrResult } from '../util/blatQuery.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export interface BlatResultWithStats extends BlatResult {
  score: number
  identity: number
  coverage: number
}

export type { IsPcrResult } from '../util/blatQuery.ts'

/**
 * #stateModel SequenceSearchWidgetModel
 */
export default function stateModelFactory(_pluginManager: PluginManager) {
  return types
    .model('SequenceSearchWidget', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal('SequenceSearchWidget'),
      /**
       * #property
       */
      mode: types.optional(types.string, 'blat'),
      /**
       * #property
       */
      sequence: types.optional(types.string, ''),
      /**
       * #property
       */
      forwardPrimer: types.optional(types.string, ''),
      /**
       * #property
       */
      reversePrimer: types.optional(types.string, ''),
      /**
       * #property
       */
      maxProductSize: types.optional(types.number, 4000),
      /**
       * #property
       */
      minPerfect: types.optional(types.number, 15),
      /**
       * #property
       */
      minGood: types.optional(types.number, 15),
      /**
       * #property
       * BLAT search type: DNA or protein
       */
      searchType: types.optional(types.string, 'DNA'),
      /**
       * #property
       * transBlat search type
       */
      transBlatType: types.optional(types.string, 'translated DNA'),
      /**
       * #property
       */
      assemblyName: types.optional(types.string, ''),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      blatResults: undefined as BlatResultWithStats[] | undefined,
      /**
       * #volatile
       */
      isPcrResults: undefined as IsPcrResult[] | undefined,
      /**
       * #volatile
       */
      loading: false,
      /**
       * #volatile
       */
      error: undefined as string | undefined,
      /**
       * #volatile
       */
      progress: '',
    }))
    .views(self => ({
      /**
       * #getter
       */
      get assemblyNames() {
        return getSession(self).assemblyNames
      },
      /**
       * #getter
       * Returns assemblies with their display names
       */
      get assembliesWithDisplayNames() {
        const session = getSession(self)
        return this.assemblyNames.map(name => {
          const asm = session.assemblyManager.get(name)
          const displayName = asm?.displayName
          return {
            name,
            displayName: displayName || name,
          }
        })
      },
      /**
       * #getter
       */
      get selectedAssembly() {
        const session = getSession(self)
        const name = self.assemblyName || this.assemblyNames[0]
        return name ? session.assemblyManager.get(name) : undefined
      },
      /**
       * #getter
       */
      get sequenceSearchConfig() {
        const asm = this.selectedAssembly
        if (asm?.configuration) {
          return asm.getConf('sequenceSearch')
        }
        return undefined
      },
      /**
       * #getter
       * Returns the database to use for BLAT/isPcr queries.
       */
      get searchDb() {
        const config = this.sequenceSearchConfig
        if (self.mode === 'isPcr') {
          return config?.isPcr?.db || config?.blat?.db || self.assemblyName || this.assemblyNames[0]
        }
        return config?.blat?.db || self.assemblyName || this.assemblyNames[0]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setMode(mode: string) {
        self.mode = mode
      },
      /**
       * #action
       */
      setSequence(seq: string) {
        self.sequence = seq
      },
      /**
       * #action
       */
      setForwardPrimer(primer: string) {
        self.forwardPrimer = primer
      },
      /**
       * #action
       */
      setReversePrimer(primer: string) {
        self.reversePrimer = primer
      },
      /**
       * #action
       */
      setMaxProductSize(size: number) {
        self.maxProductSize = size
      },
      /**
       * #action
       */
      setMinPerfect(val: number) {
        self.minPerfect = val
      },
      /**
       * #action
       */
      setMinGood(val: number) {
        self.minGood = val
      },
      /**
       * #action
       */
      setSearchType(searchType: string) {
        self.searchType = searchType
      },
      /**
       * #action
       */
      setTransBlatType(transBlatType: string) {
        self.transBlatType = transBlatType
      },
      /**
       * #action
       */
      setAssemblyName(name: string) {
        self.assemblyName = name
        localStorageSetItem('sequenceSearch-lastAssembly', name)
      },
      /**
       * #action
       */
      setBlatResults(results: BlatResultWithStats[] | undefined) {
        self.blatResults = results
      },
      /**
       * #action
       */
      setIsPcrResults(results: IsPcrResult[] | undefined) {
        self.isPcrResults = results
      },
      /**
       * #action
       */
      setLoading(loading: boolean) {
        self.loading = loading
      },
      /**
       * #action
       */
      setError(error: string | undefined) {
        self.error = error
      },
      /**
       * #action
       */
      setProgress(progress: string) {
        self.progress = progress
      },
      /**
       * #action
       */
      clearResults() {
        self.blatResults = undefined
        self.isPcrResults = undefined
        self.error = undefined
        self.progress = ''
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      runBlatSearch: flow(function* runBlatSearch() {
        const db = self.searchDb
        if (!db) {
          self.setError('No assembly selected')
          return
        }
        const seq = self.sequence.trim()
        if (!seq) {
          self.setError('No sequence provided')
          return
        }

        const isTransBlat = self.mode === 'transBlat'
        const searchType = isTransBlat ? self.transBlatType : self.searchType

        self.setLoading(true)
        self.setError(undefined)
        self.clearResults()
        self.setProgress(
          isTransBlat
            ? 'Submitting transBlat query...'
            : 'Submitting BLAT query...',
        )

        try {
          const results: BlatResult[] = yield queryBlat({
            sequence: seq,
            db,
            type: searchType,
          })

          const resultsWithStats: BlatResultWithStats[] = results.map(r => ({
            ...r,
            score: calculateScore(r),
            identity: calculateIdentity(r),
            coverage: calculateQueryCoverage(r),
          }))

          resultsWithStats.sort((a, b) => b.score - a.score)

          self.setBlatResults(resultsWithStats)
          self.setProgress(
            resultsWithStats.length
              ? `Found ${resultsWithStats.length} hits`
              : 'No hits found',
          )
        } catch (e) {
          console.error(e)
          self.setError(`${e}`)
          self.setProgress('')
        } finally {
          self.setLoading(false)
        }
      }),
      /**
       * #action
       */
      runIsPcrSearch: flow(function* runIsPcrSearch() {
        const db = self.searchDb
        if (!db) {
          self.setError('No assembly selected')
          return
        }
        const fwd = self.forwardPrimer.trim()
        const rev = self.reversePrimer.trim()
        if (!fwd || !rev) {
          self.setError('Both forward and reverse primers are required')
          return
        }
        if (fwd.length < 15) {
          self.setError('Forward primer must be at least 15 bases')
          return
        }
        if (rev.length < 15) {
          self.setError('Reverse primer must be at least 15 bases')
          return
        }

        self.setLoading(true)
        self.setError(undefined)
        self.clearResults()
        self.setProgress('Submitting In-Silico PCR query...')

        try {
          const results: IsPcrResult[] = yield queryIsPcr({
            forwardPrimer: fwd,
            reversePrimer: rev,
            db,
            maxSize: self.maxProductSize,
            minPerfect: self.minPerfect,
            minGood: self.minGood,
          })

          self.setIsPcrResults(results)
          self.setProgress(
            results.length
              ? `Found ${results.length} PCR product${results.length !== 1 ? 's' : ''}`
              : 'No PCR products found',
          )
        } catch (e) {
          console.error(e)
          self.setError(`${e}`)
          self.setProgress('')
        } finally {
          self.setLoading(false)
        }
      }),
      /**
       * #action
       */
      runSearch() {
        if (self.mode === 'isPcr') {
          this.runIsPcrSearch()
        } else {
          this.runBlatSearch()
        }
      },
      /**
       * #action
       * Open result on UCSC Genome Browser
       */
      openOnUcsc(locString: string) {
        const db = self.searchDb
        if (db) {
          const url = `https://genome.ucsc.edu/cgi-bin/hgTracks?db=${db}&position=${encodeURIComponent(locString)}`
          window.open(url, '_blank')
        }
      },
      /**
       * #action
       */
      navigateToBlatResult(result: BlatResult) {
        const session = getSession(self)
        const view = session.views.find(v => v.type === 'LinearGenomeView')
        if (view && 'navToLocString' in view) {
          const locString = `${result.tName}:${result.tStart + 1}-${result.tEnd}`
          ;(view as { navToLocString: (loc: string) => void }).navToLocString(locString)
        } else {
          if (isSessionModelWithWidgets(session)) {
            session.notify(
              'Open a Linear Genome View first to navigate to results',
              'warning',
            )
          }
        }
      },
      /**
       * #action
       */
      navigateToIsPcrResult(result: IsPcrResult) {
        const session = getSession(self)
        const view = session.views.find(v => v.type === 'LinearGenomeView')
        if (view && 'navToLocString' in view) {
          const locString = `${result.chrom}:${result.chromStart}-${result.chromEnd}`
          ;(view as { navToLocString: (loc: string) => void }).navToLocString(locString)
        } else {
          if (isSessionModelWithWidgets(session)) {
            session.notify(
              'Open a Linear Genome View first to navigate to results',
              'warning',
            )
          }
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Converts BLAT results to features for FromConfigAdapter
       */
      get blatResultsAsFeatures() {
        if (!self.blatResults) {
          return []
        }
        return self.blatResults.map((result, idx) => ({
          uniqueId: `blat-result-${idx}`,
          refName: result.tName,
          start: result.tStart,
          end: result.tEnd,
          strand: result.strand === '+' ? 1 : -1,
          name: `BLAT hit ${idx + 1}`,
          score: result.score,
          identity: result.identity,
          coverage: result.coverage,
          qName: result.qName,
          qSize: result.qSize,
          qStart: result.qStart,
          qEnd: result.qEnd,
          matches: result.matches,
          misMatches: result.misMatches,
          blockCount: result.blockCount,
          blockSizes: result.blockSizes,
          tStarts: result.tStarts,
          qStarts: result.qStarts,
          type: 'match',
          subfeatures: result.tStarts.map((tStart, i) => ({
            uniqueId: `blat-result-${idx}-block-${i}`,
            refName: result.tName,
            start: tStart,
            end: tStart + result.blockSizes[i]!,
            strand: result.strand === '+' ? 1 : -1,
            type: 'match_part',
          })),
        }))
      },
      /**
       * #getter
       * Converts isPcr results to features for FromConfigAdapter
       */
      get isPcrResultsAsFeatures() {
        if (!self.isPcrResults) {
          return []
        }
        return self.isPcrResults.map((result, idx) => ({
          uniqueId: `ispcr-result-${idx}`,
          refName: result.chrom,
          start: result.chromStart,
          end: result.chromEnd,
          strand: result.strand === '+' ? 1 : -1,
          name: `PCR product ${idx + 1}`,
          productSize: result.productSize,
          forwardPrimer: result.forwardPrimer,
          reversePrimer: result.reversePrimer,
          type: 'PCR_product',
        }))
      },
      /**
       * #getter
       */
      get resultsAdapterConfig() {
        const features =
          self.mode === 'blat' || self.mode === 'transBlat'
            ? this.blatResultsAsFeatures
            : this.isPcrResultsAsFeatures
        return {
          type: 'FromConfigAdapter',
          features,
        }
      },
      /**
       * #getter
       */
      get resultsTrackConfig() {
        const assemblyName = self.assemblyName || self.assemblyNames[0]
        const trackId = `sequence-search-results-${self.id}`
        let trackName = 'BLAT Results'
        if (self.mode === 'transBlat') {
          trackName = 'transBlat Results'
        } else if (self.mode === 'isPcr') {
          trackName = 'In-Silico PCR Results'
        }
        return {
          type: 'FeatureTrack',
          trackId,
          name: trackName,
          assemblyNames: [assemblyName],
          adapter: this.resultsAdapterConfig,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Creates a session track from the current search results
       */
      createResultsTrack() {
        const session = getSession(self)
        const features =
          self.mode === 'blat' || self.mode === 'transBlat'
            ? self.blatResultsAsFeatures
            : self.isPcrResultsAsFeatures

        if (features.length === 0) {
          if (isSessionModelWithWidgets(session)) {
            session.notify('No results to create track from', 'warning')
          }
          return
        }

        if ('addTrackConf' in session) {
          const trackConf = self.resultsTrackConfig
          ;(session as { addTrackConf: (conf: unknown) => unknown }).addTrackConf(
            trackConf,
          )

          const view = session.views.find(v => v.type === 'LinearGenomeView')
          if (view && 'showTrack' in view) {
            ;(view as { showTrack: (trackId: string) => void }).showTrack(
              trackConf.trackId,
            )
          }

          if (isSessionModelWithWidgets(session)) {
            session.notify(
              `Created track "${trackConf.name}" with ${features.length} features`,
              'success',
            )
          }
        }
      },
    }))
    .actions(self => ({
      afterCreate() {
        const lastAssembly = localStorageGetItem('sequenceSearch-lastAssembly')
        if (lastAssembly && self.assemblyNames.includes(lastAssembly)) {
          self.assemblyName = lastAssembly
        }
      },
    }))
}

export type SequenceSearchStateModel = ReturnType<typeof stateModelFactory>
export type SequenceSearchModel = Instance<SequenceSearchStateModel>
