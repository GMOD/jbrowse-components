import { getSession } from '@jbrowse/core/util'
import { useCreateOnce, useFinalUnmount } from '@jbrowse/core/util/hooks'
import { destroy } from '@jbrowse/mobx-state-tree'

import { facetedStateTreeF } from './facetedModel.ts'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * Faceted-selector UI state for the lifetime of a dialog, destroyed on unmount.
 *
 * getTracks is stored once and called from inside MobX computeds, so it must
 * read the live config tree (e.g. a model getter) rather than close over an
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
  getTracks: () => AnyConfigurationModel[],
) {
  const faceted = useCreateOnce(() => {
    const ret = facetedStateTreeF().create({})
    ret.setTrackSource(getTracks, getSession(model), model.assemblyNames)
    return ret
  })
  useFinalUnmount(() => {
    destroy(faceted)
  })
  return faceted
}
