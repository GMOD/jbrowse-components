import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types, flow, Instance } from '@jbrowse/mobx-state-tree'

import {
  queryBlat,
  calculateScore,
  calculateIdentity,
  calculateQueryCoverage,
} from '../util/blatQuery.ts'

import type { BlatResult } from '../util/blatQuery.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export interface BlatResultWithStats extends BlatResult {
  score: number
  identity: number
  coverage: number
}

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
      sequence: types.optional(types.string, ''),
      /**
       * #property
       */
      searchType: types.optional(
        types.enumeration(['DNA', 'protein', 'translated RNA', 'translated DNA']),
        'DNA',
      ),
      /**
       * #property
       */
      assemblyName: types.optional(types.string, ''),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      results: undefined as BlatResultWithStats[] | undefined,
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
       */
      get selectedAssembly() {
        const session = getSession(self)
        const name = self.assemblyName || this.assemblyNames[0]
        return name ? session.assemblyManager.get(name) : undefined
      },
      /**
       * #getter
       */
      get blatConfig() {
        const asm = this.selectedAssembly
        if (asm?.configuration) {
          const conf = asm.getConf('sequenceSearch')
          return conf?.blat
        }
        return undefined
      },
      /**
       * #getter
       * Returns the database to use for BLAT queries.
       * If sequenceSearch.blat.db is configured, uses that.
       * Otherwise falls back to the assembly name (works for UCSC assemblies).
       */
      get blatDb() {
        return this.blatConfig?.db || self.assemblyName || this.assemblyNames[0]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSequence(seq: string) {
        self.sequence = seq
      },
      /**
       * #action
       */
      setSearchType(searchType: 'DNA' | 'protein' | 'translated RNA' | 'translated DNA') {
        self.searchType = searchType
      },
      /**
       * #action
       */
      setAssemblyName(name: string) {
        self.assemblyName = name
      },
      /**
       * #action
       */
      setResults(results: BlatResultWithStats[] | undefined) {
        self.results = results
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
    }))
    .actions(self => ({
      /**
       * #action
       */
      runSearch: flow(function* runSearch() {
        const db = self.blatDb
        if (!db) {
          self.setError('No assembly selected')
          return
        }
        const seq = self.sequence.trim()
        if (!seq) {
          self.setError('No sequence provided')
          return
        }

        self.setLoading(true)
        self.setError(undefined)
        self.setResults(undefined)
        self.setProgress('Submitting BLAT query...')

        try {
          const results: BlatResult[] = yield queryBlat({
            sequence: seq,
            db,
            type: self.searchType,
          })

          const resultsWithStats: BlatResultWithStats[] = results.map(r => ({
            ...r,
            score: calculateScore(r),
            identity: calculateIdentity(r),
            coverage: calculateQueryCoverage(r),
          }))

          resultsWithStats.sort((a, b) => b.score - a.score)

          self.setResults(resultsWithStats)
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
      navigateToResult(result: BlatResult) {
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
    }))
}

export type SequenceSearchStateModel = ReturnType<typeof stateModelFactory>
export type SequenceSearchModel = Instance<SequenceSearchStateModel>
