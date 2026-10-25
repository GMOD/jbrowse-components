import { DEFAULT_BASES_FILTER } from '../../shared/basesFilter.ts'
import { basesRefinementsApplied } from '../dialogs/layerFilters.ts'

import type { ModificationsMenuModel } from './modificationsMenu.ts'
import type { Reversible } from '@jbrowse/core/ui/filterMenuItems'

/**
 * The per-base refinements in effect that differ from their defaults, for the
 * "Filter by..." count, and the clear that returns them to the defaults. The
 * refinements themselves are edited in the "More filters..." dialog.
 */
export function basesFilterNarrowing(
  model: ModificationsMenuModel,
): Reversible {
  const applied = basesRefinementsApplied(model)
  const filter = model.basesFilter
  const moved = {
    code: applied.code && filter.codes !== undefined,
    probability:
      applied.probability &&
      (filter.probability.min !== DEFAULT_BASES_FILTER.probability.min ||
        filter.probability.strict),
    context: applied.context && filter.context !== DEFAULT_BASES_FILTER.context,
  }
  const fields = Object.entries(moved)
    .filter(([, isMoved]) => isMoved)
    .map(([field]) => field)
  return {
    count: fields.length,
    clear: () => {
      if (fields.length > 0) {
        model.setBases({
          filter: Object.fromEntries(fields.map(f => [f, undefined])),
        })
      }
    },
  }
}
