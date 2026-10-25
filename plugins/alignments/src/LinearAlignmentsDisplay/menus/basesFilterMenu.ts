import { makeSizeSubMenu } from '@jbrowse/core/ui'
import { checkboxItem, makeRadioSubMenu } from '@jbrowse/core/ui/menuItems'

import {
  DEFAULT_BASES_FILTER,
  PROBABILITY,
  codeEntries,
  contextEntries,
} from '../../shared/basesFilter.ts'
import {
  cytosineContextOptions,
  getModificationName,
} from '../../shared/modificationData.ts'
import { admitsCode } from '../../shared/types.ts'

import type { BasesFilter } from '../../shared/types.ts'
import type { ModificationsMenuModel } from './modificationsMenu.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversible } from '@jbrowse/core/ui/filterMenuItems'
import type { CytosineContext } from '@jbrowse/modifications-utils'

// The floor as the slider shows it, a percent rounded for display
function probabilityPercent(filter: BasesFilter) {
  return Number((filter.probability.min * 100).toFixed(2))
}

// The current selection reads back through `admitsCode`, the reading the
// worker filter and the legend take, so the boxes reflect what is drawn.
function setModTypeShown(
  model: ModificationsMenuModel,
  type: string,
  shown: boolean,
) {
  const types = model.detectedModificationTypes
  const filter = model.basesFilter
  const visible = types.filter(t => admitsCode(filter, t))
  const next = shown ? [...visible, type] : visible.filter(t => t !== type)
  // An empty list is "every type", so unticking the last type turns the layer
  // off instead.
  if (next.length === 0) {
    model.setBases({ show: false })
    return
  }
  // Everything ticked stores the default, so a type first seen as more reads
  // stream in shows up rather than being excluded by a list written before it.
  model.setBases({
    filter: {
      code: codeEntries(types.every(t => next.includes(t)) ? undefined : next),
    },
  })
}

function modTypesItem(model: ModificationsMenuModel): MenuItem {
  const filter = model.basesFilter
  return {
    label: 'Modification types',
    subMenu: model.detectedModificationTypes.map(t =>
      checkboxItem(getModificationName(t), admitsCode(filter, t), () => {
        setModTypeShown(model, t, !admitsCode(filter, t))
      }),
    ),
  }
}

function probabilityItem(model: ModificationsMenuModel): MenuItem {
  const filter = model.basesFilter
  return makeSizeSubMenu({
    label: 'Hide calls under',
    title: 'Modification probability',
    min: 0,
    max: 100,
    step: 1,
    format: n => `${n}%`,
    // the threshold reaches the worker's extractModifications via rpcProps,
    // so commit on release, not every intermediate pixel
    commitOnRelease: true,
    getValue: () => probabilityPercent(filter),
    isDefault:
      filter.probability.min === DEFAULT_BASES_FILTER.probability.min &&
      !filter.probability.strict,
    // keeps a written `gt`: the slider moves the floor, not its test
    onChange: v => {
      model.setBases({
        filter: {
          [PROBABILITY]: [
            {
              field: PROBABILITY,
              [filter.probability.strict ? 'gt' : 'gte']: v / 100,
            },
          ],
        },
      })
    },
    onReset: () => {
      model.setBases({ filter: { [PROBABILITY]: undefined } })
    },
  })
}

function cytosineContextItem(model: ModificationsMenuModel): MenuItem {
  return makeRadioSubMenu<CytosineContext>({
    label: 'Cytosine context',
    value: model.basesFilter.context,
    options: cytosineContextOptions.map(o => [o.value, o.label] as const),
    onChange: next => {
      model.setBases({ filter: { context: contextEntries(next) } })
    },
  })
}

// Which refinements the drawn layer applies: the floor in the by-type view
// (the 2-color view paints every call), the cytosine context under bisulfite
// and in the 2-color view of cytosine methylation, and the type list wherever
// modifications draw.
function appliedRefinements(model: ModificationsMenuModel) {
  const layer = model.baseLayer
  const isMods = layer?.field === 'modifications'
  const cytosineMeth = model.detectedModificationTypes.some(
    k => k === 'm' || k === 'h',
  )
  return {
    code: isMods,
    probability: isMods && !layer.unmodified,
    context:
      layer?.field === 'bisulfite' ||
      (isMods && layer.unmodified && cytosineMeth),
  }
}

/**
 * The Filter by... rows over `pileup.bases.filter`, each present only while
 * the per-base layer it narrows draws. The type list shows where more than one
 * type is detected, and also while a type is unticked, so a list that hides
 * every type in view can still be undone. Under another layer a refinement
 * would change what this one draws the next time it is picked.
 */
export function getBasesFilterItems(model: ModificationsMenuModel): MenuItem[] {
  const applied = appliedRefinements(model)
  return [
    ...(applied.code &&
    (model.detectedModificationTypes.length > 1 || model.basesFilter.codes)
      ? [modTypesItem(model)]
      : []),
    ...(applied.probability ? [probabilityItem(model)] : []),
    ...(applied.context ? [cytosineContextItem(model)] : []),
  ]
}

/**
 * The refinements in effect that differ from their defaults, for the
 * "Filter by..." count, and the clear that returns them to the defaults.
 */
export function basesFilterNarrowing(
  model: ModificationsMenuModel,
): Reversible {
  const applied = appliedRefinements(model)
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
