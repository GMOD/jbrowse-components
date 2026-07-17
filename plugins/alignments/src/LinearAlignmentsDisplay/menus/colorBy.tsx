/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'

import { promotableRadioItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { ModificationThresholdSlider } from './ModificationThresholdSlider.tsx'
import { checkboxItem, radioItems, radioModeMenuItem } from './menuHelpers.ts'
import { radioColorOptions } from '../../shared/colorSchemes.ts'
import {
  cytosineContextOptions,
  getModificationName,
} from '../../shared/modificationData.ts'
import {
  DEFAULT_MODIFICATION_THRESHOLD,
  isModificationTypeVisible,
} from '../../shared/types.ts'

import type { ColorOption } from '../../shared/colorSchemes.ts'
import type {
  ArcColorByType,
  ColorBy,
  ModificationColorBy,
} from '../../shared/types.ts'
import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { CytosineContext } from '@jbrowse/modifications-utils'

const ColorByTagDialog = lazy(() => import('../dialogs/ColorByTagDialog.tsx'))

interface ColorByModel {
  colorBy: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

export interface ModificationsModel extends ColorByModel {
  modificationsReady: boolean
  regionTooLarge: boolean
  detectedModificationTypes: string[]
  modificationThreshold: number
}

// A model that may or may not carry the modification fields.
type AnyColorByModel = ColorByModel & Partial<ModificationsModel>

// The modification fields always travel together, so one probe narrows the whole
// group. Only a type guard for callers whose model genuinely lacks them —
// whether a section is *offered* is the caller's explicit opt-in below, never
// inferred from the model's shape. LGVSyntenyDisplay composes the alignments
// state model, so it carries every field a probe could test; sniffing gave it
// the paired-end and bisulfite sections even though a PAF block has no pairs and
// no reads to bisulfite-convert.
function modModel(model: AnyColorByModel): ModificationsModel | undefined {
  return model.modificationsReady === undefined
    ? undefined
    : (model as ModificationsModel)
}

interface ColorByMenuOptions {
  includeTagOption?: boolean
  // Insert size / pair orientation / first-of-pair — meaningful only where reads
  // come in pairs.
  includePairedEnd?: boolean
  // The MM/ML modification submenu plus reference-based bisulfite.
  includeModifications?: boolean
  colorOptions?: ColorOption[]
  // Read-connection arc coloring lives here rather than in the Read connections
  // menu — it's a rare setting and colors belong together. Omitted (like every
  // other section here) when no overlay (arcs or read cloud) is active, since
  // both share this coloring — the caller passes `undefined` in that case.
  arcColor?: {
    current: ArcColorByType
    setColor: (type: ArcColorByType) => void
  }
  // Supplementary/split-read coloring modifiers. These color how chained
  // supplementary alignments are drawn, so they belong with the color scheme
  // rather than in the "Show..." visibility menu.
  supplementaryColoring?: {
    flipStrandLongReadChains: boolean
    setFlipStrandLongReadChains: (flag: boolean) => void
    colorSupplementaryChains: boolean
    setColorSupplementaryChains: (flag: boolean) => void
  }
  // Per-value session-default pins — supplied only for displays whose colorBy
  // slot is promotable (alignments; synteny omits it). Given a colorBy value,
  // returns the pin control for making that exact scheme the session-wide
  // default, so each scheme radio carries its own pin (like every other
  // promotable setting) instead of a standalone mouthful checkbox.
  displayTypeDefault?: (colorBy: ColorBy) => DisplayTypeDefaultControl
}

// Derived from the shared COLOR_SCHEMES registry (single source of menu
// placement + shader path), in registry order so the menu is unchanged.
const basicColorOptions = radioColorOptions('basic')
const pairedEndColorOptions = radioColorOptions('pairedEnd')

const arcColorOptions: {
  value: ArcColorByType
  label: string
  subLabel?: string
  helpText?: string
}[] = [
  {
    value: 'insertSizeAndOrientation',
    label: 'Insert size and orientation',
    subLabel: 'short=pink, then orientation, then long',
    helpText:
      'Combined SV view. A short insert always paints pink regardless of orientation — at a short insert the useful signal is just "something is here", so orientation is not worth distinguishing. Otherwise an abnormal pair orientation wins (inversion, tandem duplication), and a large insert with normal orientation paints as a long insert (the classic deletion signature). Insert-size thresholds are robust to the long tail of large inserts (median ± 3·1.4826·MAD) so the short-insert signal is not washed out by a few very large outliers.',
  },
  {
    value: 'insertSize',
    label: 'Insert size',
    subLabel: 'short=pink, long=red',
    helpText:
      'Colors only by template length: short inserts pink, long inserts red, normal grey — orientation ignored. Thresholds use a robust median ± 3·1.4826·MAD spread so a tight insert-size distribution with a few very large outliers still flags genuinely short inserts.',
  },
  {
    value: 'orientation',
    label: 'Orientation',
    subLabel: 'color by pair orientation only',
    helpText:
      'Colors only by pair orientation (LR/RL/RR/LL), ignoring insert size. Useful when you only care about inversion/duplication signatures.',
  },
]

const DIVIDER: MenuItem = { type: 'divider' }

// --- modification coloring ---------------------------------------------------
// Two mode radios and three refinement submenus.
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

function currentMods(model: ModificationsModel) {
  return model.colorBy.type === 'modifications'
    ? (model.colorBy.modifications ?? {})
    : {}
}

// The 2-color view fills unmarked cytosines when the data is methylation —
// the whole methylation view in one click (in the common MM "." mode the
// unlisted cytosines are confident unmodified calls; hiding them under-paints
// the data). getMethBins is cytosine-only, so other modifications (6mA…) fall
// back to plain two-color.
function hasCytosineMeth(model: ModificationsModel) {
  return model.detectedModificationTypes.some(k => k === 'm' || k === 'h')
}

function patchMods(
  model: ModificationsModel,
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
  model: ModificationsModel,
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
function modificationsMenu(
  model: ModificationsModel,
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem {
  const mods = currentMods(model)
  const byTwoColor =
    model.colorBy.type === 'modifications' &&
    (!!mods.twoColor || !!mods.fillUnmarked)
  const twoColorView: ModificationColorBy = hasCytosineMeth(model)
    ? { fillUnmarked: true }
    : { twoColor: true }
  const types = model.detectedModificationTypes
  const clearView = { twoColor: undefined, fillUnmarked: undefined }

  return {
    label: 'Modifications',
    helpText:
      'Color the ONT/PacBio modification calls in these reads: by which modification each call is, or by whether each site is modified at all. Refine with the per-type filter, threshold and cytosine context below.',
    subMenu: [
      promotableRadioItem({
        label: 'One color per modification type',
        helpText: `Colors each call by which modification it is (5mC, 5hmC, 6mA…). Only positions the basecaller called, at or above the probability threshold (${model.modificationThreshold}%), are drawn — everything else stays blank.`,
        checked: model.colorBy.type === 'modifications' && !byTwoColor,
        onClick: () => {
          patchMods(model, clearView)
        },
        displayTypeDefault: displayTypeDefault?.({ type: 'modifications' }),
      }),
      promotableRadioItem({
        label: 'One color per type, plus low-probability & unmodified in blue',
        helpText:
          'Everything the by-type view does, plus it paints the not-modified side blue instead of leaving it blank: modified sites keep their per-type colors, while low-probability and unmodified sites turn blue. For methylation data every cytosine in context is drawn, including the ones the basecaller left implicit; for other modifications the called positions are drawn, blue where the call is more likely negative. The probability threshold does not apply here. Named as in IGV ("base modification 2-color") — with both 5mC and 5hmC present the palette is strictly more than two colors.',
        checked: byTwoColor,
        onClick: () => {
          patchMods(model, { ...clearView, ...twoColorView })
        },
        displayTypeDefault: displayTypeDefault?.({
          type: 'modifications',
          modifications: twoColorView,
        }),
      }),
      DIVIDER,
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
          {
            label: 'threshold',
            type: 'custom',
            render: () => (
              <ModificationThresholdSlider
                initialValue={model.modificationThreshold}
                onCommit={v => {
                  patchMods(model, { threshold: v })
                }}
              />
            ),
          },
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
    ],
  }
}

// Bisulfite / EM-seq is reference-based (read-vs-reference C→T), so it needs no
// MM/ML tags and applies to any alignments display — it sits beside
// "Modifications" rather than inside it. Picking a cytosine context activates
// it; CpG (context) and two-color (both defaults) are omitted from the scheme so
// a default session carries no redundant fields.
function bisulfiteItem(model: ModificationsModel): MenuItem {
  const isBis = model.colorBy.type === 'bisulfite'
  const mods = isBis ? (model.colorBy.modifications ?? {}) : {}
  const context = mods.cytosineContext ?? 'CG'
  const twoColor = !!mods.twoColor

  const setBisulfite = (
    nextContext: CytosineContext,
    nextTwoColor: boolean,
  ) => {
    model.setColorScheme({
      type: 'bisulfite',
      modifications: {
        ...(nextContext === 'CG' ? {} : { cytosineContext: nextContext }),
        ...(nextTwoColor ? { twoColor: true } : {}),
      },
    })
  }

  return {
    label: 'Bisulfite / EM-seq',
    helpText:
      'Reference-based methylation read from C→T conversion; needs no MM/ML tags. Methylated cytosines paint red, by cytosine context — turn on "Show unmethylated" to paint the converted sites blue as well.',
    subMenu: [
      ...radioItems<CytosineContext>(
        cytosineContextOptions,
        isBis ? context : undefined,
        next => {
          setBisulfite(next, twoColor)
        },
      ),
      ...(isBis
        ? [
            DIVIDER,
            checkboxItem(
              'Show unmethylated (blue)',
              twoColor,
              () => {
                setBisulfite(context, !twoColor)
              },
              {
                helpText:
                  'When on, the unmethylated (converted) sites paint blue as well as the methylated ones painting red. Off by default, so a track reads as presence/absence of methylation rather than a red/blue mix on every read.',
              },
            ),
          ]
        : []),
    ],
  }
}

// --- menu sections: each returns its items, or [] when not applicable --------

// A plain radio that selects a whole color scheme (no extra config). When the
// display is promotable, each row also carries its own pin (endAdornment) that
// makes that exact scheme the session-wide default for this display type.
function colorRadio(
  model: AnyColorByModel,
  { label, type }: ColorOption,
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem {
  return promotableRadioItem({
    label,
    checked: model.colorBy.type === type,
    onClick: () => {
      model.setColorScheme({ type })
    },
    displayTypeDefault: displayTypeDefault?.({ type }),
  })
}

function schemeRadios(
  model: AnyColorByModel,
  colorOptions: ColorOption[] | undefined,
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem[] {
  return (colorOptions ?? basicColorOptions).map(o =>
    colorRadio(model, o, displayTypeDefault),
  )
}

function tagSection(model: AnyColorByModel, include: boolean): MenuItem[] {
  return include
    ? [
        {
          label: 'Tag...',
          type: 'radio',
          checked: model.colorBy.type === 'tag',
          onClick: () => {
            getSession(model).queueDialog((onClose: () => void) => [
              ColorByTagDialog,
              { model, handleClose: onClose },
            ])
          },
        },
      ]
    : []
}

function pairedEndSection(
  model: ModificationsModel | undefined,
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem[] {
  return model
    ? [
        {
          label: 'Paired end',
          subMenu: pairedEndColorOptions.map(o =>
            colorRadio(model, o, displayTypeDefault),
          ),
        },
      ]
    : []
}

// The MM/ML "Modifications" submenu shows while types are still loading (unless
// the region is too large to ever detect them) or once any type has loaded; a
// ready display with zero detected types falls through to bisulfite only.
// Bisulfite is reference-based, so it applies to any alignments display
// regardless of MM/ML tags.
function modificationsSection(
  model: ModificationsModel | undefined,
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem[] {
  const loading = model && !model.modificationsReady && !model.regionTooLarge
  const hasTypes = !!model?.detectedModificationTypes.length
  return model
    ? [
        ...(model.modificationsReady && hasTypes
          ? [modificationsMenu(model, displayTypeDefault)]
          : loading
            ? [
                {
                  label: 'Loading modifications...',
                  disabled: true,
                  onClick() {},
                },
              ]
            : []),
        bisulfiteItem(model),
      ]
    : []
}

function arcColorSection(arcColor: ColorByMenuOptions['arcColor']): MenuItem[] {
  return arcColor
    ? [
        radioModeMenuItem(
          'Arc color',
          arcColorOptions,
          arcColor.current,
          arcColor.setColor,
          'How paired-end arcs and the read cloud overlay are colored by insert size and/or pair orientation, to surface structural-variant signal (deletions, inversions, duplications, insertions).',
        ),
      ]
    : []
}

function supplementarySection(
  supp: ColorByMenuOptions['supplementaryColoring'],
): MenuItem[] {
  return supp
    ? [
        {
          label: 'Supplementary / split reads',
          subMenu: [
            checkboxItem(
              'Color supplementary alignments by primary strand',
              supp.flipStrandLongReadChains,
              () => {
                supp.setFlipStrandLongReadChains(!supp.flipStrandLongReadChains)
              },
            ),
            checkboxItem(
              'Color supplementary chains orange',
              supp.colorSupplementaryChains,
              () => {
                supp.setColorSupplementaryChains(!supp.colorSupplementaryChains)
              },
            ),
          ],
        },
      ]
    : []
}

export function getColorByMenuItem(
  model: AnyColorByModel,
  options: ColorByMenuOptions = {},
) {
  const mods = modModel(model)
  return {
    label: 'Color by...',
    type: 'subMenu' as const,
    icon: Palette,
    subMenu: [
      schemeRadios(model, options.colorOptions, options.displayTypeDefault),
      tagSection(model, options.includeTagOption ?? false),
      pairedEndSection(
        options.includePairedEnd ? mods : undefined,
        options.displayTypeDefault,
      ),
      modificationsSection(
        options.includeModifications ? mods : undefined,
        options.displayTypeDefault,
      ),
      arcColorSection(options.arcColor),
      supplementarySection(options.supplementaryColoring),
    ].flat(),
  }
}
