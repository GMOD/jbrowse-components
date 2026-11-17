import { getConf } from '@jbrowse/core/configuration'
import { getEnv, getSession } from '@jbrowse/core/util'
import { useCreateOnce, useFinalUnmount } from '@jbrowse/core/util/hooks'
import { destroy } from '@jbrowse/mobx-state-tree'

import { facetedStateTreeF } from './facetedModel.ts'
import { trackTypeShortName } from './facetedUtil.ts'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'
import type { AnyTrackConfig } from '@jbrowse/core/configuration'

/**
 * Faceted-selector UI state for the lifetime of a dialog, destroyed on unmount.
 *
 * `initial` is called once, when the model is created, so the starting values
 * it reads (the tree's query) are not observed by the caller's render.
 *
 * getTracks (and getColumnTracks, the wider list columns are chosen from) is
 * stored once and called from inside MobX computeds, so it must read the live
 * config tree (e.g. a model getter) rather than close over an
 * already-materialized array — otherwise the grid keeps rows for tracks that
 * have since been deleted.
 *
 * Both hooks are load-bearing under StrictMode, which jbrowse-web mounts in, and
 * the plain spellings of each were wrong here. `useState(() => …)` built two
 * models per mount and dropped the second; `useEffect(() => () => destroy(…))`
 * destroyed the surviving one while the dialog was still open, so every read in
 * the grid threw `[mobx-state-tree] … [dead]`. Same pair, same reasons, as the
 * embedded products' `useCreateViewState`.
 */
export function useFacetedModel(
  model: HierarchicalTrackSelectorModel,
  getTracks: () => AnyTrackConfig[],
  initial?: () => {
    filterText?: string
    showFilters?: boolean
    getColumnTracks?: () => AnyTrackConfig[]
  },
) {
  const faceted = useCreateOnce(() => {
    const { getColumnTracks, ...snapshot } = initial?.() ?? {}
    const session = getSession(model)
    const ret = facetedStateTreeF().create(snapshot)
    ret.setTrackSource(getTracks, session, model.assemblyNames, getColumnTracks)
    const columns: unknown = getConf(session, [
      'hierarchical',
      'table',
      'columns',
    ])
    ret.setConfiguredColumns(
      Array.isArray(columns)
        ? columns.filter((c): c is string => typeof c === 'string')
        : [],
    )
    const names = new Map(
      getEnv(model)
        .pluginManager.getTrackElements()
        .map(t => [t.name, trackTypeShortName(t.displayName)]),
    )
    ret.setTrackTypeName(type => names.get(type) ?? type)
    return ret
  })
  useFinalUnmount(() => {
    destroy(faceted)
  })
  return faceted
}
