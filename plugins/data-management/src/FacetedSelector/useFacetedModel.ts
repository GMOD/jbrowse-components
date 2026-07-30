import { useEffect, useState } from 'react'

import { getSession } from '@jbrowse/core/util'
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
 */
export function useFacetedModel(
  model: HierarchicalTrackSelectorModel,
  getTracks: () => AnyConfigurationModel[],
) {
  const [faceted] = useState(() => {
    const ret = facetedStateTreeF().create({})
    ret.setTrackSource(getTracks, getSession(model), model.assemblyNames)
    return ret
  })
  useEffect(
    () => () => {
      destroy(faceted)
    },
    [faceted],
  )
  return faceted
}
