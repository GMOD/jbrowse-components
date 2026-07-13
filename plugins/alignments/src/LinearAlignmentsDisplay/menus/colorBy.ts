import { lazy } from 'react'

import { promotableRadioItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { checkboxItem, radioItems, radioModeMenuItem } from './menuHelpers.ts'
import { makeModificationThresholdItem } from './modificationThresholdMenu.tsx'
import { radioColorOptions } from '../../shared/colorSchemes.ts'
import { modificationData } from '../../shared/modificationData.ts'
import { modificationThresholdField } from '../../shared/types.ts'

import type { ColorOption } from '../../shared/colorSchemes.ts'
import type { ArcColorByType, ColorBy } from '../../shared/types.ts'
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
  visibleModificationTypes: string[]
  modificationThreshold: number
}

// A model that may or may not carry the modification fields — the alignments
// display has all of them, a synteny display has none.
type AnyColorByModel = ColorByModel & Partial<ModificationsModel>

// The modification fields always travel together, so one probe narrows the whole
// group. `modModel(model)` returns the narrowed model or undefined, letting the
// menu sniff the display kind exactly once instead of re-testing per section.
function modModel(model: AnyColorByModel): ModificationsModel | undefined {
  return model.modificationsReady === undefined
    ? undefined
    : (model as ModificationsModel)
}

interface ColorByMenuOptions {
  includeTagOption?: boolean
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

const cytosineContextOptions: { value: CytosineContext; label: string }[] = [
  { value: 'CG', label: 'CpG' },
  { value: 'CHG', label: 'CHG' },
  { value: 'CHH', label: 'CHH' },
  { value: 'all', label: 'All cytosines' },
]

const DIVIDER: MenuItem = { type: 'divider' }

// --- scheme setters: one place that writes each colorBy shape ---------------

function setByType(
  model: ModificationsModel,
  twoColor: boolean,
  onlyKey?: string,
) {
  model.setColorScheme({
    type: 'modifications',
    modifications: {
      ...(twoColor ? { twoColor: true } : {}),
      // isolating one type writes an allow-list (shownModifications), not a
      // deny-list of every other type — so "only 6mA" stays 6mA-only even if a
      // new modification type is later detected in the reads.
      ...(onlyKey ? { shownModifications: [onlyKey] } : {}),
      ...modificationThresholdField(model.modificationThreshold),
    },
  })
}

// methylation/bisulfite share the cytosine-context field; both omit the CpG
// default so CpG sessions don't carry it.
function setContextScheme(
  model: ModificationsModel,
  type: 'methylation' | 'bisulfite',
  context: CytosineContext,
) {
  model.setColorScheme({
    type,
    modifications: {
      ...(type === 'methylation'
        ? modificationThresholdField(model.modificationThreshold)
        : {}),
      ...(context === 'CG' ? {} : { cytosineContext: context }),
    },
  })
}

// --- "Color by methylation": red/blue methylated-vs-unmethylated summary -----

// Shown only when a cytosine methylation type (5mC/5hmC) is present — getMethBins
// summarizes those, so a plain 6mA or RNA-mod track falls through to by-type.
// The context picker is always visible (no activate-first reveal), and the
// probability threshold does not apply (each site shows its most-likely state).
function buildMethylationItem(model: ModificationsModel): MenuItem[] {
  const isMeth = model.colorBy.type === 'methylation'
  const context = model.colorBy.modifications?.cytosineContext ?? 'CG'
  const hasCytosineMeth = model.visibleModificationTypes.some(
    k => k === 'm' || k === 'h',
  )
  return hasCytosineMeth
    ? [
        {
          label: 'Color by methylation',
          subLabel: 'methylated vs. unmethylated (red / blue)',
          helpText:
            'Pick this to see methylation patterns — CpG islands, hypomethylated regions. Colors every cytosine in the chosen context, including ones the basecaller left implicit (so hypomethylation shows as blue), and merges 5mC/5hmC into one call per site. Each site shows its most-likely state (≈50% split), so the probability threshold does not apply here.',
          subMenu: radioItems<CytosineContext>(
            cytosineContextOptions,
            isMeth ? context : undefined,
            next => {
              setContextScheme(model, 'methylation', next)
            },
          ),
        },
      ]
    : []
}

// --- "Color by modification type": raw per-call view, any modification -------

function buildByTypeItem(model: ModificationsModel): MenuItem {
  const { visibleModificationTypes: types, modificationThreshold } = model
  const mods = model.colorBy.modifications
  const hidden = mods?.hiddenModifications ?? []
  const shown = mods?.shownModifications
  const activeTwoColor = !!mods?.twoColor
  const isModType = model.colorBy.type === 'modifications'
  const modName = (k: string) => modificationData[k]?.name ?? k
  // exactly one type shown, vs all shown. The allow-list (shownModifications)
  // wins when present; legacy sessions with a deny-list (hiddenModifications)
  // still resolve correctly.
  const onlyKey = (k: string) =>
    shown?.length
      ? shown.length === 1 && shown[0] === k
      : types.every(t => t === k || hidden.includes(t))
  const allVisible = !shown?.length && !hidden.some(k => types.includes(k))
  // multiple types → per-type radios (filter in one click); single type → the
  // all/only distinction is meaningless, so just one radio per mode.
  const multiType = types.length > 1

  const byTypeHelpText = `Colors each modification call by its type. Only calls at or above the probability threshold (${modificationThreshold}%) are shown.`
  const twoColorHelpText =
    'Shades each called base by probability: at least 50% in the modification color, below 50% in blue. Only positions the caller listed are drawn.'

  // One radio for a (mode, scope) cell. scope `undefined` = "all types"; a key =
  // "only that type". The checked test is the single source for both modes.
  const radio = (
    label: string,
    twoColor: boolean,
    onlyK: string | undefined,
    helpText?: string,
  ): MenuItem => ({
    label,
    type: 'radio',
    helpText,
    checked:
      isModType &&
      activeTwoColor === twoColor &&
      (onlyK === undefined ? !multiType || allVisible : onlyKey(onlyK)),
    onClick: () => {
      setByType(model, twoColor, onlyK)
    },
  })

  // "all" (or the single-type radio) followed by a per-type radio for each type
  // when there's more than one.
  const modeRadios = (twoColor: boolean, help: string): MenuItem[] => [
    radio(
      multiType
        ? twoColor
          ? 'Two-color (all)'
          : 'All modification types'
        : twoColor
          ? 'Two-color'
          : 'By modification type',
      twoColor,
      undefined,
      help,
    ),
    ...(multiType
      ? types.map(k =>
          radio(
            twoColor ? `Two-color: ${modName(k)}` : modName(k),
            twoColor,
            k,
          ),
        )
      : []),
  ]

  // Threshold gates only the by-type radios above (see extractModifications:
  // `prob >= modThreshold`); two-color ignores it (fixed 50% cutoff) and
  // methylation ignores it (most-likely state). So it lives here, not at the
  // modifications top level where it would imply it affects every mode. Inline
  // slider (commits on release — it's a tier-1 refetch) rather than a dialog.
  return {
    label: 'Color by modification type',
    subLabel: 'each modification its own color (5mC, 5hmC, 6mA…)',
    helpText:
      'Pick this to inspect the raw per-call data or non-methylation modifications. Colors each call by its modification type; only positions the caller listed are drawn. Two-color instead shades each listed call red/blue by probability.',
    subMenu: [
      ...modeRadios(false, byTypeHelpText),
      ...(multiType ? [DIVIDER] : []),
      ...modeRadios(true, twoColorHelpText),
      DIVIDER,
      makeModificationThresholdItem(model),
    ],
  }
}

// MM/ML coloring promoted to the top of "Color by...": the methylation summary
// (when present) plus the per-call view, no longer nested under a "Base
// modifications (MM tag)" parent — both already carry self-describing labels.
function buildModificationsItems(model: ModificationsModel): MenuItem[] {
  return model.modificationsReady
    ? [...buildMethylationItem(model), buildByTypeItem(model)]
    : [{ label: 'Loading modifications...', disabled: true, onClick() {} }]
}

// Show the MM/ML mode submenu while types are still loading (unless the region
// is too large to ever detect them) or once any type has loaded. A ready display
// with zero detected types falls through — only bisulfite (Advanced) remains.
function showModificationItems(model: ModificationsModel): boolean {
  return (
    (!model.modificationsReady && !model.regionTooLarge) ||
    model.visibleModificationTypes.length > 0
  )
}

// Bisulfite / EM-seq is reference-based (read-vs-reference C→T), so it needs no
// MM/ML tags and applies to any alignments display — but it's only meaningful
// for bisulfite libraries, so it's tucked under "Advanced".
function buildAdvancedItem(model: ModificationsModel): MenuItem {
  const isBis = model.colorBy.type === 'bisulfite'
  const context = model.colorBy.modifications?.cytosineContext ?? 'CG'
  return {
    label: 'Advanced',
    subMenu: [
      {
        label: 'Bisulfite / EM-seq (no MM/ML tags)',
        helpText:
          'Reference-based methylation read from C→T conversion; needs no MM/ML tags. Methylated red, unmethylated blue, by cytosine context.',
        subMenu: radioItems<CytosineContext>(
          cytosineContextOptions,
          isBis ? context : undefined,
          next => {
            setContextScheme(model, 'bisulfite', next)
          },
        ),
      },
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
          label: 'Color by tag...',
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

// MM/ML modes only when the data actually carries modifications (still shown
// while loading — see showModificationItems). Bisulfite (Advanced) is
// reference-based so it applies to any alignments display regardless of MM/ML
// tags.
function modificationsSection(
  model: ModificationsModel | undefined,
): MenuItem[] {
  return model
    ? [
        ...(showModificationItems(model) ? buildModificationsItems(model) : []),
        buildAdvancedItem(model),
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
          'How paired-end arcs and the read-cloud (samplot) overlay are colored by insert size and/or pair orientation, to surface structural-variant signal (deletions, inversions, duplications, insertions).',
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
      pairedEndSection(mods, options.displayTypeDefault),
      modificationsSection(mods),
      arcColorSection(options.arcColor),
      supplementarySection(options.supplementaryColoring),
    ].flat(),
  }
}
