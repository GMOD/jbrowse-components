import { makeDisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import { checkboxItem, promotableRadioItem } from '@jbrowse/core/ui'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import { capitalizeFirst, pluralize } from '@jbrowse/core/util'
import { heightModeMenuItems } from '@jbrowse/plugin-linear-genome-view'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import HeightIcon from '@mui/icons-material/Height'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { inlineRadioGroup } from './baseModelHelpers.ts'
import { showHiddenFeaturesMenuItems } from './featureContextMenu.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { ShowLabelsMode } from './showLabelsMode.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { HeightModeMenuModel } from '@jbrowse/plugin-linear-genome-view'

// Single source for the size-preset radio options and their labels, so a
// fourth mode can't drift between the menu and the label lookup.
const displayModeOptions: { value: DisplayMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'compact', label: 'Compact' },
  { value: 'superCompact', label: 'Super-compact' },
  { value: 'collapsed', label: 'Collapsed' },
]

export const STRAND_COLOR_JEXL =
  "jexl:get(feature,'strand')==1?'tomato':get(feature,'strand')==-1?'cornflowerblue':'goldenrod'"

// Structural for the same reason as FeatureMenuSelf: the model factory calls
// these builders, so it can't hand them its own inferred type. The model is
// passed in at the call site, so a drifted field fails to typecheck there.
interface ShowSubmenuSelf {
  featureNoun: string
  showDescriptions: boolean
  // What the render actually does with showDescriptions: collapsed mode and the
  // auto-labels density gate both suppress them. Read here so the checkbox can
  // say why it looks inert — see showSubmenuCheckboxItems.
  effectiveShowDescriptions: boolean
  showOutline: boolean
  showLabelsMode: ShowLabelsMode
  setShowDescriptions: (value: boolean) => void
  setShowOutline: (value: boolean) => void
  setShowLabels: (mode: ShowLabelsMode) => void
}

interface ColorMenuSelf {
  colorByMode: string
  openSetColorDialog: () => void
  openColorByAttributeDialog: () => void
  setFeatureColor: (color: string) => void
}

interface FeatureHeightSelf extends IAnyStateTreeNode, HeightModeMenuModel {
  featureNoun: string
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
    checkboxItem(
      'Show descriptions',
      self.showDescriptions,
      () => {
        self.setShowDescriptions(!self.showDescriptions)
      },
      // Ticked-but-inert is the confusing state: collapsed mode drops every
      // label, and the auto-labels density gate takes descriptions down with
      // the names. Say so rather than disabling the row — the setting is still
      // meaningful, it just isn't reaching the canvas at this zoom/mode.
      self.showDescriptions && !self.effectiveShowDescriptions
        ? { subLabel: 'Hidden by the current label settings' }
        : undefined,
    ),
    checkboxItem('Show outline', self.showOutline, () => {
      self.setShowOutline(!self.showOutline)
    }),
  ]
}

// The radio groups of the "Show..." submenu, each a subHeader + inline radios.
// Rendered after the checkboxes; subclasses override to append.
export function showSubmenuRadioGroups(self: ShowSubmenuSelf): MenuItem[] {
  return inlineRadioGroup(
    `${capitalizeFirst(self.featureNoun)} labels`,
    self.showLabelsMode,
    [
      { value: 'auto', label: 'Auto (hide when dense)' },
      { value: 'on', label: 'Always on' },
      { value: 'off', label: 'Always off' },
    ],
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
      onClick: () => {
        self.openColorByAttributeDialog()
      },
    },
  ]
}

// One "<Noun> height" menu with two independent radio groups, mirroring the
// alignments display: the size presets (how tall each feature is drawn) and,
// under a "Track sizing" subheader, how the track responds when there are more
// features than fit — scroll / expand / squeeze. The two axes are orthogonal, so
// picking a size never changes the mode and vice versa. Shared by every canvas
// display (genes, variants).
export function featureHeightMenuItems(self: FeatureHeightSelf): MenuItem[] {
  return [
    {
      label: `${capitalizeFirst(self.featureNoun)} height`,
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
            displayTypeDefault: makeDisplayTypeDefaultControl(
              self,
              'displayMode',
              option.value,
            ),
          }),
        ),
        { type: 'subHeader' as const, label: 'Track sizing' },
        ...heightModeMenuItems(self, self.featureNoun),
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
  return recovery.length
    ? [
        {
          label: 'Edit filters',
          icon: FilterAltIcon,
          subMenu: [filterBy, ...recovery],
        },
      ]
    : [filterBy]
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
