import { makePin } from '@jbrowse/core/configuration'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import { checkboxItem, promotableRadioItem } from '@jbrowse/core/ui/menuItems'
import { pluralize } from '@jbrowse/core/util'
import { heightModeMenuItems } from '@jbrowse/plugin-linear-genome-view'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import HeightIcon from '@mui/icons-material/Height'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { STRAND_COLOR_JEXL } from '../RenderFeatureDataRPC/featureColors.ts'
import { inlineRadioGroup } from './baseModelHelpers.ts'
import { showHiddenFeaturesMenuItems } from './featureContextMenu.ts'
import { SHOW_LABELS_MODES } from './showLabelsMode.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { ShowLabelsMode } from './showLabelsMode.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { HeightModeMenuModel } from '@jbrowse/plugin-linear-genome-view'

// Single source for the size-preset radio options and their labels, so a
// fourth mode can't drift between the menu and the label lookup.
const displayModeOptions: { value: DisplayMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'compact', label: 'Compact' },
  { value: 'superCompact', label: 'Super-compact' },
  { value: 'collapsed', label: 'Collapsed' },
]

// What the two recovery groups (clear highlights, the filter family) carry so
// they sort to the bottom of the track menu. Every menu level sorts by
// `priority` (CascadingMenu) and the sort is stable, so this pins them below
// whatever a subclass appends — LinearBasicDisplay's "Gene glyph" landed after
// "Filter by..." otherwise — while staying above the track's own "Display
// types" at -1000. Shared by both groups so they stay adjacent.
const RECOVERY_PRIORITY = -100

// Structural for the same reason as FeatureMenuSelf: the model factory calls
// these builders, so it can't hand them its own inferred type. The model is
// passed in at the call site, so a drifted field fails to typecheck there.
interface ShowSubmenuSelf {
  showOutline: boolean
  showLabelsMode: ShowLabelsMode
  // Collapsed mode drops every label kind regardless of the chosen rung, so the
  // selected radio can sit there describing text nothing is painting. Read here
  // to say why rather than disabling the group — the choice is still meaningful,
  // it just isn't reaching the canvas in this display mode. ('auto' hiding at
  // high density needs no such note: that is the mode doing its advertised job.)
  displayMode: DisplayMode
  setShowOutline: (value: boolean) => void
  setShowLabels: (mode: ShowLabelsMode) => void
}

interface ColorMenuSelf {
  colorByMode: string
  openSetColorDialog: () => void
  openColorByAttributeDialog: () => void
  setFeatureColor: (color: string) => void
}

interface FeatureHeightSelf extends IStateTreeNode, HeightModeMenuModel {
  displayMode: DisplayMode
  setDisplayMode: (value: DisplayMode) => void
}

interface TrackMenuSelf {
  featureNoun: string
  hiddenFeatureCount: number
  featureHighlightCount: number
  // the model's own answer (subclasses OR in their filters), not recomputed
  // here from its parts — see hasFeatureFilters on the canvas base
  hasFeatureFilters: () => boolean
  showSubmenuMenuItems: () => MenuItem[]
  featureHeightMenuItems: () => MenuItem[]
  colorMenuItems: () => MenuItem[]
  clearFeatureHighlights: () => void
  openFilterDialog: () => void
  clearAllFeatureFilters: () => void
  showAllHidden: () => void
}

// The track-level "Clear N highlights" recovery item. Per-feature "Remove
// highlight" needs the boxed feature under the cursor, and a highlight outlives
// the navigation that created it (a text-search highlight is only ever replaced
// by the next search) — so without this a highlight the user has panned away
// from is unreachable. Empty when nothing is highlighted, matching the
// "Show N hidden features" / "Clear all filters" shape.
function clearHighlightsMenuItems(self: {
  featureHighlightCount: number
  clearFeatureHighlights: () => void
}): MenuItem[] {
  const n = self.featureHighlightCount
  return n > 0
    ? [
        {
          label: `Clear ${n} ${pluralize(n, 'highlight')}`,
          icon: Highlighter,
          priority: RECOVERY_PRIORITY,
          onClick: () => {
            self.clearFeatureHighlights()
          },
        },
      ]
    : []
}

// The checkbox rows of the "Show..." submenu. Subclasses append their own via the
// showSubmenuCheckboxItems override; the flat list of all checkboxes is rendered
// before the radio groups so the menu reads top-to-bottom as
// checkboxes-then-radios rather than an interleaved mix.
export function showSubmenuCheckboxItems(self: ShowSubmenuSelf): MenuItem[] {
  return [
    checkboxItem('Show outline', self.showOutline, () => {
      self.setShowOutline(!self.showOutline)
    }),
  ]
}

// Wording for the label radio, and the single place the mode order is fixed.
// 'auto' leads because it's the default and the mode that needs no thought; the
// four pinned rungs then read most-to-least text.
const SHOW_LABELS_OPTION_LABELS: Record<ShowLabelsMode, string> = {
  auto: 'Auto',
  nameAndDescription: 'Name + description',
  name: 'Name only',
  description: 'Description only',
  none: 'None',
}

// The radio groups of the "Show..." submenu, each a subHeader + inline radios.
// Rendered after the checkboxes; subclasses override to append.
export function showSubmenuRadioGroups(self: ShowSubmenuSelf): MenuItem[] {
  const inert = self.displayMode === 'collapsed'
  return inlineRadioGroup(
    'Labels',
    self.showLabelsMode,
    SHOW_LABELS_MODES.map(value => ({
      value,
      label: SHOW_LABELS_OPTION_LABELS[value],
      subLabel:
        inert && value === self.showLabelsMode && value !== 'none'
          ? 'Hidden while collapsed'
          : undefined,
    })),
    mode => {
      self.setShowLabels(mode)
    },
  )
}

// The "Color by..." radio choices (solid/strand/attribute), shared so subclasses
// can reuse them while assembling their own color menu.
export function colorBySubMenuItems(self: ColorMenuSelf): MenuItem[] {
  return [
    {
      label: 'Solid color...',
      type: 'radio' as const,
      checked: self.colorByMode === 'solid',
      // opts out of the checkbox/radio default: this opens a dialog, so it
      // dismisses like any other action (same split as the multi-row "Row
      // height" group, whose "Custom..." peer does too)
      keepMenuOpen: false,
      onClick: () => {
        self.openSetColorDialog()
      },
    },
    {
      label: 'Strand',
      type: 'radio' as const,
      checked: self.colorByMode === 'strand',
      onClick: () => {
        self.setFeatureColor(STRAND_COLOR_JEXL)
      },
    },
    {
      label: 'Attribute...',
      type: 'radio' as const,
      checked: self.colorByMode === 'attribute',
      keepMenuOpen: false,
      onClick: () => {
        self.openColorByAttributeDialog()
      },
    },
  ]
}

// One "Set feature height" menu with two independent radio groups, mirroring
// the alignments display: the size presets (how tall each feature is drawn) and,
// under a "Track sizing" subheader, how the track responds when there are more
// features than fit — scroll / expand / squeeze. The two axes are orthogonal, so
// picking a size never changes the mode and vice versa. Shared by every canvas
// display (genes, variants), and worded with the generic "feature" throughout
// rather than each display's featureNoun — "Variant height" reads like a
// different setting than "Feature height" when it is the same one. The noun
// still varies where it names content rather than a control ("Show 3 hidden
// variants").
export function featureHeightMenuItems(self: FeatureHeightSelf): MenuItem[] {
  return [
    {
      label: 'Set feature height',
      icon: HeightIcon,
      subMenu: [
        // Each preset row carries its own pin (endAdornment): the radio
        // selects the mode for this track, the pin promotes that preset
        // as the session-wide default for this display type. displayMode
        // is a sentinel promotable slot, so every preset — `normal`
        // included — is customizable back over another session default.
        ...displayModeOptions.map(option =>
          promotableRadioItem({
            label: option.label,
            checked: self.displayMode === option.value,
            onClick: () => {
              self.setDisplayMode(option.value)
            },
            pin: makePin(
              self,
              'displayMode',
              option.value,
            ),
          }),
        ),
        { type: 'subHeader' as const, label: 'Track sizing' },
        ...heightModeMenuItems(self, 'feature'),
      ],
    },
  ]
}

// The canvas track menu. Reads its three grouped sections back off `self`
// (showSubmenuMenuItems / featureHeightMenuItems / colorMenuItems) rather than
// calling the builders above directly, so a subclass's override of any of them
// lands here.
export function canvasTrackMenuItems(self: TrackMenuSelf): MenuItem[] {
  return [
    {
      label: 'Show...',
      icon: VisibilityIcon,
      subMenu: self.showSubmenuMenuItems(),
    },
    ...self.featureHeightMenuItems(),
    ...self.colorMenuItems(),
    ...clearHighlightsMenuItems(self),
    ...filterMenuItems(self),
  ]
}

// The filter family. On an unfiltered track this is the single "Filter by..."
// dialog opener, so it sits at the top level — an "Edit filters" submenu
// wrapping one row is pure indirection (same rule copyItems applies to itself).
// Once something is narrowing the view the recovery items join it and the group
// earns its submenu.
function filterMenuItems(self: TrackMenuSelf): MenuItem[] {
  const filterBy = {
    label: 'Filter by...',
    icon: FilterAltIcon,
    onClick: () => {
      self.openFilterDialog()
    },
  }
  const recovery = [
    // Track-level unhide: the per-feature "Show N hidden" item is only
    // reachable from a still-visible feature's menu, so this is the sole
    // recovery once every feature in view is hidden.
    ...showHiddenFeaturesMenuItems(self),
    ...(self.hasFeatureFilters()
      ? [
          {
            label: 'Clear all filters',
            icon: FilterAltOffIcon,
            onClick: () => {
              self.clearAllFeatureFilters()
            },
          },
        ]
      : []),
  ]
  // the priority rides the top-level row, never `filterBy` itself — inside the
  // submenu it would sort the dialog opener below the recovery rows it heads
  return recovery.length
    ? [
        {
          label: 'Edit filters',
          icon: FilterAltIcon,
          priority: RECOVERY_PRIORITY,
          subMenu: [filterBy, ...recovery],
        },
      ]
    : [{ ...filterBy, priority: RECOVERY_PRIORITY }]
}

// The color-related track-menu entry: a single "Color by..." whose "Solid
// color..." choice opens the solid+UTR color picker. Reads the choices back off
// `self` rather than calling colorBySubMenuItems directly — variants overrides
// that model method to swap in its consequence/SV-type presets and relies on this
// wrapper picking them up.
export function colorMenuItems(self: {
  colorBySubMenuItems: () => MenuItem[]
}): MenuItem[] {
  return [
    {
      label: 'Color by...',
      icon: PaletteIcon,
      subMenu: self.colorBySubMenuItems(),
    },
  ]
}
