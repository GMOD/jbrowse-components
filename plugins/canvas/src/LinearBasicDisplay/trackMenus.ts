import { makeDisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import { promotableRadioItem } from '@jbrowse/core/ui'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import { heightModeMenuItems } from '@jbrowse/plugin-linear-genome-view'
import ClearAllIcon from '@mui/icons-material/ClearAll'
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

// Single source for the "Feature height" radio options and their labels, so a
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
  showDescriptions: boolean
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
  displayMode: DisplayMode
  setDisplayMode: (value: DisplayMode) => void
}

interface TrackMenuSelf {
  hiddenFeatureIds: { length: number }
  featureHighlights: { length: number }
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
// "Show N hidden features" / "Clear filters" shape.
function clearHighlightsMenuItems(self: {
  featureHighlights: { length: number }
  clearFeatureHighlights: () => void
}) {
  const n = self.featureHighlights.length
  return n > 0
    ? [
        {
          label: `Clear ${n} highlight${n > 1 ? 's' : ''}`,
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
    {
      label: 'Show descriptions',
      type: 'checkbox' as const,
      checked: self.showDescriptions,
      keepMenuOpen: true,
      onClick: () => {
        self.setShowDescriptions(!self.showDescriptions)
      },
    },
    {
      label: 'Show outline',
      type: 'checkbox' as const,
      checked: self.showOutline,
      keepMenuOpen: true,
      onClick: () => {
        self.setShowOutline(!self.showOutline)
      },
    },
  ]
}

// The radio groups of the "Show..." submenu, each a subHeader + inline radios.
// Rendered after the checkboxes; subclasses override to append.
export function showSubmenuRadioGroups(self: ShowSubmenuSelf): MenuItem[] {
  return inlineRadioGroup(
    'Feature labels',
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

// One "Feature height" menu with two independent radio groups, mirroring the
// alignments display: the size presets (how tall each feature is drawn) and,
// under a "Track sizing" subheader, how the track responds when there are more
// features than fit — scroll / expand / squeeze. The two axes are orthogonal, so
// picking a size never changes the mode and vice versa. Shared by every canvas
// display (genes, variants).
export function featureHeightMenuItems(self: FeatureHeightSelf): MenuItem[] {
  return [
    {
      label: 'Feature height',
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
            keepMenuOpen: true,
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
  const hasFeatureFilters = self.hasFeatureFilters()
  return [
    {
      label: 'Show...',
      icon: VisibilityIcon,
      subMenu: self.showSubmenuMenuItems(),
    },
    ...self.featureHeightMenuItems(),
    ...self.colorMenuItems(),
    ...clearHighlightsMenuItems(self),
    {
      label: 'Edit filters',
      icon: FilterAltIcon,
      subMenu: [
        {
          label: 'Filter by...',
          icon: ClearAllIcon,
          onClick: () => {
            self.openFilterDialog()
          },
        },
        // Track-level unhide: the per-feature "Show N hidden" item is
        // only reachable from a still-visible feature's menu, so this is
        // the sole recovery once every feature in view is hidden.
        ...showHiddenFeaturesMenuItems(self),
        ...(hasFeatureFilters
          ? [
              {
                label: 'Clear filters',
                icon: FilterAltOffIcon,
                onClick: () => {
                  self.clearAllFeatureFilters()
                },
              },
            ]
          : []),
      ],
    },
  ]
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
