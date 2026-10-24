import { makeSizeMenu } from '@jbrowse/core/ui'
import { checkboxItem, radioItem, radioItems } from '@jbrowse/core/ui/menuItems'

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

import type { BaseLayer, BasesFilter, BasesPatch } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { CytosineContext } from '@jbrowse/modifications-utils'

// The MM/ML modification color scheme: two mode radios, two refinement
// submenus and a threshold slider. Split from colorBy.ts because everything below shares one writer
// (`patchMods`) and one slot shape that nothing else in the color menu touches;
// reference-based bisulfite is its sibling, not its parent, and lives in
// bisulfiteMenu.ts.
//
// The two radios echo each other on purpose: 2-color is by-type *plus* one extra
// step, so the labels say exactly that ("One color per modification type" /
// "...plus low-probability & unmodified in blue"). Modified sites keep their
// per-type colors in both; 2-color additionally paints the not-modified side
// blue instead of leaving it blank. IGV's searchable term "2-color" lives in the
// helpText rather than the label. It is NOT named "probability": both views
// shade by probability (see `prob` in features/modification/extract.ts), so that
// named a shared axis — and it collided with "Probability threshold" below,
// which gates only the by-type view.
//
// Mode switches write `pileup.bases.unmodified` and refinements its `filter`
// by field, so switching the view keeps the filter intact and vice versa.

// What this submenu reads, and no more. The caller's fuller
// `ModificationsModel` (which also carries the readiness flags gating whether
// this submenu is built at all) extends it.
export interface ModificationsMenuModel {
  baseLayer: BaseLayer | undefined
  basesFilter: BasesFilter
  setBases: (patch: BasesPatch) => void
  detectedModificationTypes: string[]
}

const DIVIDER: MenuItem = { type: 'divider' }

// The context picks the cytosines the 2-color view fills, so it bites only
// on cytosine methylation; getMethBins is cytosine-only, and other
// modifications (6mA…) draw their calls in plain two-color.
function hasCytosineMeth(model: ModificationsMenuModel) {
  return model.detectedModificationTypes.some(k => k === 'm' || k === 'h')
}

// The floor as the slider shows it, a percent rounded for display
function probabilityPercent(filter: BasesFilter) {
  return Number((filter.probability.min * 100).toFixed(2))
}

// Tick/untick one modification type. The current selection is read back through
// `admitsCode`, the reading the worker filter and the legend take, so the
// boxes always reflect what is actually drawn.
function setModTypeShown(
  model: ModificationsMenuModel,
  type: string,
  shown: boolean,
) {
  const types = model.detectedModificationTypes
  const filter = model.basesFilter
  const visible = types.filter(t => admitsCode(filter, t))
  const next = shown ? [...visible, type] : visible.filter(t => t !== type)
  // An empty list is "every type" (the slot's default), so unticking the last
  // type turns the layer off instead; ticking one from there turns it back on
  // with that type alone.
  if (next.length === 0) {
    model.setBases({ show: false })
    return
  }
  // Everything ticked = follow the data: store the default, so a type first
  // seen as more reads stream in shows up rather than being silently excluded
  // by a list that was written before it was detected.
  model.setBases({
    filter: {
      code: codeEntries(types.every(t => next.includes(t)) ? undefined : next),
    },
  })
}

// The "Modifications" submenu: two mode radios then the refinements.
// Each refinement shows only when it bites — the type filter when >1 type is
// detected, cytosine context when the data is cytosine methylation. Threshold
// gates only the by-type view (two-color uses a fixed 50% cutoff; the fill
// paints every cytosine), which the 2-color radio states.
//
// All three are revealed only once this scheme is the active one, like
// bisulfite's "Show unmethylated" — see `refinements` below for why.
export function modificationsMenu(model: ModificationsMenuModel): MenuItem {
  const filter = model.basesFilter
  const isActive = model.baseLayer?.field === 'modifications'
  const byTwoColor = isActive && model.baseLayer?.unmodified === true
  const types = model.detectedModificationTypes

  // The three refinements, revealed together once this is the active scheme and
  // each present only where it bites. One `isActive` rather than one per row:
  // they share the reveal, and the divider above them is derived from the list
  // so it cannot outlive the section it separates (the rule `withSubHeader`
  // states for a heading).
  //
  // A refinement writes the filter alone, which under another layer would
  // change what that layer draws the next time modifications are picked.
  const refinements: MenuItem[] = isActive
    ? [
        ...(types.length > 1
          ? [
              {
                label: 'Modification types',
                helpText:
                  'Which modification types are drawn, in the by-type and 2-color views. Every type is drawn until you untick one. Basecallers increasingly emit several types on the same read (5mC, 5hmC, 6mA), so these are independent — untick 5hmC to read gene-body 5mC on a 5mCG_5hmCG model, and keep any combination you like.',
                subMenu: types.map(t =>
                  checkboxItem(
                    getModificationName(t),
                    admitsCode(filter, t),
                    () => {
                      setModTypeShown(model, t, !admitsCode(filter, t))
                    },
                  ),
                ),
              },
            ]
          : []),
        // Inline, not a submenu: one slider among a few rows costs less than
        // a fourth menu level. The 2-color radio's help says it ignores this.
        makeSizeMenu({
          label: 'Probability threshold',
          title: 'Hide calls under',
          min: 0,
          max: 100,
          step: 1,
          format: n => `${n}%`,
          // tier-1: the threshold reaches the worker's extractModifications
          // via rpcProps, so commit on release, not every intermediate pixel.
          commitOnRelease: true,
          getValue: () => probabilityPercent(filter),
          isDefault:
            filter.probability.min === DEFAULT_BASES_FILTER.probability.min &&
            !filter.probability.strict,
          onChange: v => {
            model.setBases({
              filter: { [PROBABILITY]: [{ field: PROBABILITY, gte: v / 100 }] },
            })
          },
          onReset: () => {
            model.setBases({ filter: { [PROBABILITY]: undefined } })
          },
        }),
        ...(hasCytosineMeth(model)
          ? [
              {
                label: 'Cytosine context',
                helpText:
                  'Which cytosines the 2-color (methylation) view paints. Plants use CHG/CHH.',
                subMenu: radioItems<CytosineContext>(
                  cytosineContextOptions,
                  filter.context,
                  next => {
                    model.setBases({
                      filter: { context: contextEntries(next) },
                    })
                  },
                ),
              },
            ]
          : []),
      ]
    : []

  return {
    label: 'Modifications',
    helpText:
      'Color the ONT/PacBio modification calls in these reads: by which modification each call is, or by whether each site is modified at all. Refine with the per-type filter, threshold and cytosine context below.',
    subMenu: [
      radioItem(
        'One color per modification type',
        isActive && !byTwoColor,
        () => {
          model.setBases({
            show: true,
            field: 'modifications',
            unmodified: false,
          })
        },
        {
          helpText: `Colors each call by which modification it is (5mC, 5hmC, 6mA…). Only positions the basecaller called, at or above the probability threshold (${probabilityPercent(filter)}%), are drawn — everything else stays blank.`,
        },
      ),
      radioItem(
        'One color per type, plus low-probability & unmodified in blue',
        byTwoColor,
        () => {
          model.setBases({
            show: true,
            field: 'modifications',
            unmodified: true,
          })
        },
        {
          helpText:
            'Everything the by-type view does, plus it paints the not-modified side blue instead of leaving it blank: modified sites keep their per-type colors, while low-probability and unmodified sites turn blue. For methylation data every cytosine in context is drawn, including the ones the basecaller left implicit; for other modifications the called positions are drawn, blue where the call is more likely negative. The probability threshold does not apply here. Named as in IGV ("base modification 2-color") — with both 5mC and 5hmC present the palette is strictly more than two colors.',
        },
      ),
      ...(refinements.length ? [DIVIDER, ...refinements] : []),
    ],
  }
}
