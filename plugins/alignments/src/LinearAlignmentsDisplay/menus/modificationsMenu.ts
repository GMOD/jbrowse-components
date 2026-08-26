import { makeSizeMenu } from '@jbrowse/core/ui'
import {
  checkboxItem,
  promotableRadioItem,
  radioItems,
} from '@jbrowse/core/ui/menuItems'

import {
  cytosineContextOptions,
  getModificationName,
} from '../../shared/modificationData.ts'
import {
  DEFAULT_MODIFICATION_THRESHOLD,
  isModificationTypeVisible,
} from '../../shared/types.ts'

import type { ColorBy, ModificationColorBy } from '../../shared/types.ts'
import type { Pin } from '@jbrowse/core/configuration'
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
// `patchMods` is the single writer: it merges a patch into the current
// modifications and normalizes, dropping defaults so a saved session carries no
// redundant fields. Mode switches and refinement edits are both just patches, so
// switching the view keeps threshold/context/type-filter intact and vice versa.

// What this submenu reads, and no more. The caller's fuller
// `ModificationsModel` (which also carries the readiness flags gating whether
// this submenu is built at all) extends it.
export interface ModificationsMenuModel {
  colorBy: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
  detectedModificationTypes: string[]
  modificationThreshold: number
}

const DIVIDER: MenuItem = { type: 'divider' }

function currentMods(model: ModificationsMenuModel) {
  return model.colorBy.type === 'modifications'
    ? (model.colorBy.modifications ?? {})
    : {}
}

// The 2-color view fills unmarked cytosines when the data is methylation —
// the whole methylation view in one click (in the common MM "." mode the
// unlisted cytosines are confident unmodified calls; hiding them under-paints
// the data). getMethBins is cytosine-only, so other modifications (6mA…) fall
// back to plain two-color.
function hasCytosineMeth(model: ModificationsMenuModel) {
  return model.detectedModificationTypes.some(k => k === 'm' || k === 'h')
}

function patchMods(
  model: ModificationsMenuModel,
  patch: Partial<ModificationColorBy>,
) {
  const m = { ...currentMods(model), ...patch }
  const keepThreshold =
    m.threshold !== undefined && m.threshold !== DEFAULT_MODIFICATION_THRESHOLD
  model.setColorScheme({
    type: 'modifications',
    modifications: {
      ...(m.twoColor ? { twoColor: true } : {}),
      ...(m.fillUnmarked ? { fillUnmarked: true } : {}),
      // Persisted whenever present, empty list included — `[]` is a real state
      // (every type unticked, no marks drawn), distinct from absent (= show
      // every detected type), which is the default and stays omitted.
      ...(m.shownModifications !== undefined
        ? { shownModifications: m.shownModifications }
        : {}),
      ...(m.hiddenModifications?.length
        ? { hiddenModifications: m.hiddenModifications }
        : {}),
      ...(keepThreshold ? { threshold: m.threshold } : {}),
      ...(m.cytosineContext && m.cytosineContext !== 'CG'
        ? { cytosineContext: m.cytosineContext }
        : {}),
    },
  })
}

// Tick/untick one modification type. The current selection is read back through
// isModificationTypeVisible — the same predicate the worker filter and the
// legend use — so the boxes always reflect what is actually drawn, including
// when a hand-written config expressed the filter as a hiddenModifications
// deny-list. The write is always an allow-list, and clears that deny-list, so
// the two mechanisms can't stack into a confusing state.
function setModTypeShown(
  model: ModificationsMenuModel,
  type: string,
  shown: boolean,
) {
  const types = model.detectedModificationTypes
  const mods = currentMods(model)
  const visible = types.filter(t => isModificationTypeVisible(mods, t))
  const next = shown ? [...visible, type] : visible.filter(t => t !== type)
  // Everything ticked = follow the data: store nothing, so a type first seen as
  // more reads stream in shows up rather than being silently excluded by a list
  // that was written before it was detected.
  patchMods(model, {
    shownModifications: types.every(t => next.includes(t)) ? undefined : next,
    hiddenModifications: undefined,
  })
}

// The "Modifications" submenu: two mode radios then the refinement submenus.
// Each refinement shows only when it bites — the type filter when >1 type is
// detected, cytosine context when the data is cytosine methylation. Threshold
// gates only the by-type view (two-color uses a fixed 50% cutoff; the fill
// paints every cytosine), which its caption states. The promotion pin on each
// radio promotes the bare view (no refinements baked in).
//
// All three are revealed only once this scheme is the active one, like
// bisulfite's "Show unmethylated" — see `refinements` below for why.
export function modificationsMenu(
  model: ModificationsMenuModel,
  // The per-value session-default pin factory, absent for a display whose
  // colorBy slot isn't promotable. Spelled out rather than reached back for from
  // colorBy.ts's options bag, which would make the import cycle.
  pin: ((colorBy: ColorBy) => Pin) | undefined,
): MenuItem {
  const mods = currentMods(model)
  const isActive = model.colorBy.type === 'modifications'
  const byTwoColor = isActive && (!!mods.twoColor || !!mods.fillUnmarked)
  const twoColorView: ModificationColorBy = hasCytosineMeth(model)
    ? { fillUnmarked: true }
    : { twoColor: true }
  const types = model.detectedModificationTypes
  const clearView = { twoColor: undefined, fillUnmarked: undefined }

  // The three refinements, revealed together once this is the active scheme and
  // each present only where it bites. One `isActive` rather than one per row:
  // they share the reveal, and the divider above them is derived from the list
  // so it cannot outlive the section it separates (the rule `withSubHeader`
  // states for a heading).
  //
  // `patchMods` is the single writer and it always writes
  // `type: 'modifications'`, so a refinement clicked from another scheme both
  // switched the scheme and rebuilt it from `{}` — which silently threw away a
  // `bisulfite` selection, its own cytosine context included, from the row
  // directly beneath. That is what the shared reveal is protecting.
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
      promotableRadioItem({
        label: 'One color per modification type',
        helpText: `Colors each call by which modification it is (5mC, 5hmC, 6mA…). Only positions the basecaller called, at or above the probability threshold (${model.modificationThreshold}%), are drawn — everything else stays blank.`,
        checked: isActive && !byTwoColor,
        onClick: () => {
          patchMods(model, clearView)
        },
        pin: pin?.({ type: 'modifications' }),
      }),
      promotableRadioItem({
        label: 'One color per type, plus low-probability & unmodified in blue',
        helpText:
          'Everything the by-type view does, plus it paints the not-modified side blue instead of leaving it blank: modified sites keep their per-type colors, while low-probability and unmodified sites turn blue. For methylation data every cytosine in context is drawn, including the ones the basecaller left implicit; for other modifications the called positions are drawn, blue where the call is more likely negative. The probability threshold does not apply here. Named as in IGV ("base modification 2-color") — with both 5mC and 5hmC present the palette is strictly more than two colors.',
        checked: byTwoColor,
        onClick: () => {
          patchMods(model, { ...clearView, ...twoColorView })
        },
        pin: pin?.({
          type: 'modifications',
          modifications: twoColorView,
        }),
      }),
      ...(refinements.length ? [DIVIDER, ...refinements] : []),
    ],
  }
}
