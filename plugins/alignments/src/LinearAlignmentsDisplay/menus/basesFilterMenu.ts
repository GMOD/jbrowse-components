import { deepEqual } from '@jbrowse/core/util/deepEqual'

import {
  CODE,
  PROBABILITY,
  codeEntries,
  probabilityEntries,
} from '../../shared/basesFilter.ts'
import { basesRefinementsApplied } from '../dialogs/layerFilters.ts'

import type { LayerFiltersModel } from '../dialogs/layerFilters.ts'
import type { ModificationsMenuModel } from './modificationsMenu.ts'
import type { Reversible } from '@jbrowse/core/ui/filterMenuItems'

/**
 * The per-base refinements in effect that differ from what the track's config
 * declares, for the "Filter by" count, and the clear that writes the declared
 * ones back. The refinements themselves are edited in the "More filters..."
 * dialog.
 */
export function basesFilterNarrowing(
  model: ModificationsMenuModel & Pick<LayerFiltersModel, 'declaredFilters'>,
): Reversible {
  const applied = basesRefinementsApplied(model)
  const filter = model.basesFilter
  const declared = model.declaredFilters.basesFilter
  const restores = {
    ...(applied.code && !deepEqual(filter.codes, declared.codes)
      ? { [CODE]: codeEntries(declared.codes) }
      : {}),
    ...(applied.probability &&
    !deepEqual(filter.probability, declared.probability)
      ? { [PROBABILITY]: probabilityEntries(declared.probability) }
      : {}),
  }
  const count = Object.keys(restores).length
  return {
    count,
    clear: () => {
      if (count > 0) {
        model.setBases({ filter: restores })
      }
    },
  }
}
