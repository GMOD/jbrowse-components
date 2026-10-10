import { makeSizeMenu } from '@jbrowse/core/ui'
import { checkboxItem, radioItem, radioItems } from '@jbrowse/core/ui/menuItems'

import {
  cytosineContextOptions,
  getModificationName,
} from '../../shared/modificationData.ts'
import {
  DEFAULT_MODIFICATION_THRESHOLD,
  isModificationTypeVisible,
} from '../../shared/types.ts'

import type { BaseLayer, ModificationColorBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { CytosineContext } from '@jbrowse/modifications-utils'

// The MM/ML modification color scheme: two mode radios and three refinement
// submenus. Split from colorBy.ts because everything below shares one writer
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
// `patchMods` is the single writer: it merges a patch into the slot. Mode
// switches and refinement edits are both just patches, so switching the view
// keeps threshold/context/type-filter intact and vice versa.

// What this submenu reads, and no more. The caller's fuller
// `ModificationsModel` (which also carries the readiness flags gating whether
// this submenu is built at all) extends it.
export interface ModificationsMenuModel {
  baseLayer: BaseLayer | undefined
  modificationSettings: ModificationColorBy
  setBaseLayer: (layer?: BaseLayer) => void
  detectedModificationTypes: string[]
  modificationThreshold: number
}

const DIVIDER: MenuItem = { type: 'divider' }

// The slot, not `baseLayer.modifications`: a layer switched away and back keeps
// its threshold, type filter and context.
function currentMods(model: ModificationsMenuModel) {
  return model.modificationSettings
}

// The 2-color view fills unmarked cytosines when the data is methylation —
// the whole methylation view in one click (in the common MM "." mode the
// unlisted cytosines are confident unmodified calls; hiding them under-paints
// the data). getMethBins is cytosine-only, so other modifications (6mA…) fall
// back to plain two-color.
function hasCytosineMeth(model: ModificationsMenuModel) {
  return model.detectedModificationTypes.some(k => k === 'm' || k === 'h')
}

// The slot is a typed object, so a member left at its default is the default:
// the merge is the whole normalization.
function patchMods(
  model: ModificationsMenuModel,
  patch: Partial<ModificationColorBy>,
) {
  model.setBaseLayer({
    type: 'modifications',
    modifications: { ...currentMods(model), ...patch },
  })
}

// Tick/untick one modification type. The current selection is read back through
// isModificationTypeVisible — the same predicate the worker filter and the
// legend use — so the boxes always reflect what is actually drawn.
function setModTypeShown(
  model: ModificationsMenuModel,
  type: string,
  shown: boolean,
) {
  const types = model.detectedModificationTypes
  const mods = currentMods(model)
  const visible = types.filter(t => isModificationTypeVisible(mods, t))
  const next = shown ? [...visible, type] : visible.filter(t => t !== type)
  // An empty list is "every type" (the slot's default), so unticking the last
  // type turns the layer off instead; ticking one from there turns it back on
  // with that type alone.
  if (next.length === 0) {
    model.setBaseLayer()
    return
  }
  // Everything ticked = follow the data: store the default, so a type first
  // seen as more reads stream in shows up rather than being silently excluded
  // by a list that was written before it was detected.
  patchMods(model, {
    shownModifications: types.every(t => next.includes(t)) ? [] : next,
  })
}

// The "Modifications" submenu: two mode radios then the refinement submenus.
// Each refinement shows only when it bites — the type filter when >1 type is
// detected, cytosine context when the data is cytosine methylation. Threshold
// gates only the by-type view (two-color uses a fixed 50% cutoff; the fill
// paints every cytosine), which its caption states.
//
// All three are revealed only once this scheme is the active one, like
// bisulfite's "Show unmethylated" — see `refinements` below for why.
export function modificationsMenu(model: ModificationsMenuModel): MenuItem {
  const mods = currentMods(model)
  const isActive = model.baseLayer?.type === 'modifications'
  const byTwoColor = isActive && (!!mods.twoColor || !!mods.fillUnmarked)
  const twoColorView: ModificationColorBy = hasCytosineMeth(model)
    ? { fillUnmarked: true }
    : { twoColor: true }
  const types = model.detectedModificationTypes
  const clearView = { twoColor: false, fillUnmarked: false }

  // The three refinements, revealed together once this is the active scheme and
  // each present only where it bites. One `isActive` rather than one per row:
  // they share the reveal, and the divider above them is derived from the list
  // so it cannot outlive the section it separates (the rule `withSubHeader`
  // states for a heading).
  //
  // `patchMods` always writes `type: 'modifications'`, so a refinement offered
  // under another layer would switch the layer as a side effect.
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
                    isModificationTypeVisible(mods, t),
                    () => {
                      setModTypeShown(
                        model,
                        t,
                        !isModificationTypeVisible(mods, t),
                      )
                    },
                  ),
                ),
              },
            ]
          : []),
        {
          label: 'Probability threshold',
          helpText:
            'Hides low-confidence calls in the by-type view. The 2-color view is not affected: it uses a fixed 50% cutoff, and the methylation fill paints every cytosine regardless.',
          subMenu: [
            makeSizeMenu({
              label: 'threshold',
              title: 'Hide calls under',
              min: 0,
              max: 100,
              step: 1,
              format: n => `${n}%`,
              // tier-1: the threshold reaches the worker's extractModifications
              // via rpcProps, so commit on release, not every intermediate
              // pixel.
              commitOnRelease: true,
              getValue: () => model.modificationThreshold,
              isDefault:
                model.modificationThreshold === DEFAULT_MODIFICATION_THRESHOLD,
              onChange: v => {
                patchMods(model, { threshold: v })
              },
              onReset: () => {
                patchMods(model, { threshold: DEFAULT_MODIFICATION_THRESHOLD })
              },
            }),
          ],
        },
        ...(hasCytosineMeth(model)
          ? [
              {
                label: 'Cytosine context',
                helpText:
                  'Which cytosines the 2-color (methylation) view paints. Plants use CHG/CHH.',
                subMenu: radioItems<CytosineContext>(
                  cytosineContextOptions,
                  mods.cytosineContext ?? 'CG',
                  next => {
                    patchMods(model, { cytosineContext: next })
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
          patchMods(model, clearView)
        },
        {
          helpText: `Colors each call by which modification it is (5mC, 5hmC, 6mA…). Only positions the basecaller called, at or above the probability threshold (${model.modificationThreshold}%), are drawn — everything else stays blank.`,
        },
      ),
      radioItem(
        'One color per type, plus low-probability & unmodified in blue',
        byTwoColor,
        () => {
          patchMods(model, { ...clearView, ...twoColorView })
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
