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
    helpText:
      'Which modification types are drawn. Basecallers often emit several on one read (5mC, 5hmC, 6mA): untick 5hmC to read gene-body 5mC on a 5mCG_5hmCG model.',
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
    help: 'Hide modification calls below this probability.',
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
    helpText:
      'Which cytosines the methylation colors paint. Plants methylate CHG and CHH as well as CpG.',
    value: model.basesFilter.context,
    options: cytosineContextOptions.map(o => [o.value, o.label] as const),
    onChange: next => {
      model.setBases({ filter: { context: contextEntries(next) } })
    },
  })
}

/**
 * The Filter by... rows over `pileup.bases.filter`, each present only while
 * the per-base layer it narrows draws: the type list where more than one type
 * is detected, the probability floor in the by-type view (the 2-color view
 * paints every call), and the cytosine context where the cytosines painted
 * depend on it (bisulfite, and the 2-color view of cytosine methylation).
 * Under another layer a refinement would change what this one draws the next
 * time it is picked.
 */
export function getBasesFilterItems(model: ModificationsMenuModel): MenuItem[] {
  const layer = model.baseLayer
  if (layer?.field === 'bisulfite') {
    return [cytosineContextItem(model)]
  }
  if (layer?.field !== 'modifications') {
    return []
  }
  const types = model.detectedModificationTypes
  const cytosineMeth = types.some(k => k === 'm' || k === 'h')
  return [
    ...(types.length > 1 ? [modTypesItem(model)] : []),
    ...(layer.unmodified ? [] : [probabilityItem(model)]),
    ...(layer.unmodified && cytosineMeth ? [cytosineContextItem(model)] : []),
  ]
}
