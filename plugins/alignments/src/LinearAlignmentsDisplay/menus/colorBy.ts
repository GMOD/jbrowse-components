import { lazy } from 'react'

import { promotableRadioItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { checkboxItem, radioItems, radioModeMenuItem } from './menuHelpers.ts'
import { radioColorOptions } from '../../shared/colorSchemes.ts'
import { cytosineContextOptions } from '../../shared/modificationData.ts'

import type { ColorOption } from '../../shared/colorSchemes.ts'
import type { ArcColorByType, ColorBy } from '../../shared/types.ts'
import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { CytosineContext } from '@jbrowse/modifications-utils'

const ColorByTagDialog = lazy(() => import('../dialogs/ColorByTagDialog.tsx'))
const ModificationColorSettingsDialog = lazy(
  () => import('../dialogs/ModificationColorSettingsDialog.tsx'),
)

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

const DIVIDER: MenuItem = { type: 'divider' }

// --- modification coloring: one consistent menu ------------------------------
// The view is chosen by two orthogonal controls — color by type vs by
// probability, and whether to fill unmarked cytosines. Every fine-grained
// refinement lives in the Advanced dialog. Setters rewrite the whole colorBy
// through setColorScheme but read the current value first, so switching the view
// keeps the refinements (threshold / context / per-type filter) intact.

function currentMods(model: ModificationsModel) {
  return model.colorBy.type === 'modifications'
    ? (model.colorBy.modifications ?? {})
    : {}
}

function hasCytosineMeth(model: ModificationsModel) {
  return model.visibleModificationTypes.some(k => k === 'm' || k === 'h')
}

// The colorBy each radio writes and promotes. The "Probability" radio fills
// unmarked cytosines when the data supports it — that is the methylation view
// and the useful default (in the common MM "." mode the unlisted cytosines are
// confident unmodified calls, so hiding them under-paints the data). getMethBins
// is cytosine-only, so other modifications (6mA…) fall back to plain two-color.
// Refinements (threshold / context / per-type filter) are layered on in the
// Advanced dialog and deliberately NOT baked into the promoted default.
function byTypeColorBy(): ColorBy {
  return { type: 'modifications' }
}
function probabilityColorBy(model: ModificationsModel): ColorBy {
  return {
    type: 'modifications',
    modifications: hasCytosineMeth(model)
      ? { fillUnmarked: true }
      : { twoColor: true },
  }
}

// Switch the view, preserving the Advanced-dialog refinements. Drops only the
// view flags (twoColor / fillUnmarked) so the rest of the current colorBy rides
// along.
function setView(model: ModificationsModel, colorBy: ColorBy) {
  const { twoColor: _t, fillUnmarked: _f, ...refinements } = currentMods(model)
  model.setColorScheme({
    ...colorBy,
    modifications: { ...refinements, ...colorBy.modifications },
  })
}

// Bisulfite/EM-seq is its own reference-based scheme (no MM/ML tags); it carries
// only the cytosine context, omitting the CpG default.
function setBisulfiteContext(
  model: ModificationsModel,
  context: CytosineContext,
) {
  model.setColorScheme({
    type: 'bisulfite',
    modifications: context === 'CG' ? {} : { cytosineContext: context },
  })
}

// --- "Modifications (MM/ML tag)": one consistent menu ------------------------
// Two radios (by type vs by probability) plus the Advanced dialog — the
// same rows regardless of the active view or the detected mod types. There is no
// separate "methylation" or "fill" mode: the red/blue view just fills unmarked
// cytosines when the data is methylation, which is the whole methylation view in
// one click. The fiddly knobs live in the Advanced dialog, not a deep submenu.
function buildModificationsMenu(
  model: ModificationsModel,
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem {
  const mods = currentMods(model)
  const isMod = model.colorBy.type === 'modifications'
  const isByType = isMod && !mods.twoColor && !mods.fillUnmarked
  const isProbability = isMod && (!!mods.twoColor || !!mods.fillUnmarked)
  const probability = probabilityColorBy(model)

  return {
    label: 'Modifications (MM/ML tag)',
    subLabel: 'base modification calls (5mC, 5hmC, 6mA…)',
    helpText:
      'Color the ONT/PacBio modification calls in these reads: by modification type, or red/blue by probability (methylated red, unmethylated blue). Probability threshold, cytosine context and per-type filtering are under Advanced settings.',
    subMenu: [
      promotableRadioItem({
        label: 'Type',
        subLabel: 'each modification its own color (5mC, 5hmC, 6mA…)',
        helpText: `Colors each call by its modification type. Only positions the basecaller called, at or above the probability threshold (${model.modificationThreshold}%), are drawn.`,
        checked: isByType,
        onClick: () => {
          setView(model, byTypeColorBy())
        },
        displayTypeDefault: displayTypeDefault?.(byTypeColorBy()),
      }),
      promotableRadioItem({
        label: 'Probability (red / blue)',
        subLabel: 'methylated red, unmethylated blue',
        helpText:
          'Colors each position red/blue by modification probability. For methylation data this is the methylation view: every cytosine in context is colored, including the ones the basecaller left implicit (shown blue). For other modifications only the called positions are drawn.',
        checked: isProbability,
        onClick: () => {
          setView(model, probability)
        },
        displayTypeDefault: displayTypeDefault?.(probability),
      }),
      DIVIDER,
      {
        label: 'Advanced settings…',
        helpText:
          'Probability threshold, cytosine context (CpG/CHG/CHH) and per-type filtering.',
        onClick: () => {
          getSession(model).queueDialog((onClose: () => void) => [
            ModificationColorSettingsDialog,
            { model, handleClose: onClose },
          ])
        },
      },
    ],
  }
}

// MM/ML coloring promoted to the top of "Color by...": a single "Modifications
// (MM/ML tag)" entry whose two radios (by type / by probability) each carry a
// session-default pin, so any view — the methylation (probability + fill) view
// included — can be made the display type's default, just like the top-level
// scheme radios.
function buildModificationsItems(
  model: ModificationsModel,
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem[] {
  return model.modificationsReady
    ? [buildModificationsMenu(model, displayTypeDefault)]
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
// MM/ML tags and applies to any alignments display (even one with no MM mods, so
// it sits beside "Modifications (MM/ML tag)" rather than inside it). Picking a
// cytosine context activates it; the CpG default is omitted from the scheme.
function buildBisulfiteItem(model: ModificationsModel): MenuItem {
  const isBis = model.colorBy.type === 'bisulfite'
  const context = model.colorBy.modifications?.cytosineContext ?? 'CG'
  return {
    label: 'Bisulfite / EM-seq (no MM/ML tags)',
    helpText:
      'Reference-based methylation read from C→T conversion; needs no MM/ML tags. Methylated red, unmethylated blue, by cytosine context.',
    subMenu: radioItems<CytosineContext>(
      cytosineContextOptions,
      isBis ? context : undefined,
      next => {
        setBisulfiteContext(model, next)
      },
    ),
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

// MM/ML modes only when the data actually carries modifications (still shown
// while loading — see showModificationItems). Bisulfite is reference-based so it
// applies to any alignments display regardless of MM/ML tags.
function modificationsSection(
  model: ModificationsModel | undefined,
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem[] {
  return model
    ? [
        ...(showModificationItems(model)
          ? buildModificationsItems(model, displayTypeDefault)
          : []),
        buildBisulfiteItem(model),
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
      modificationsSection(mods, options.displayTypeDefault),
      arcColorSection(options.arcColor),
      supplementarySection(options.supplementaryColoring),
    ].flat(),
  }
}
