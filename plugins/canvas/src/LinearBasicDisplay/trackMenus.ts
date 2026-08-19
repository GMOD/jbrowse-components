import { makePin } from '@jbrowse/core/configuration'
import { filterMenuItems, undoItems } from '@jbrowse/core/ui/filterMenuItems'
import {
  promotableRadioItems,
  radioItems,
  showLegendCheckboxItem,
  toggleItem,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { heightModeMenuItems } from '@jbrowse/plugin-linear-genome-view'
import HeightIcon from '@mui/icons-material/Height'
import PaletteIcon from '@mui/icons-material/Palette'

import { STRAND_COLOR_JEXL } from '../RenderFeatureDataRPC/featureColors.ts'
import { SHOW_LABELS_MODES } from './showLabelsMode.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { CanvasColorLegend } from './baseModel.ts'
import type { LinearBasicDisplayConfig } from './configSchema.ts'
import type { ShowLabelsMode } from './showLabelsMode.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'
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

// What the recovery rows (clear highlights, unpin, the filter family) carry so
// they sort to the bottom of the track menu. Every menu level sorts by
// `priority` (CascadingMenu) and the sort is stable, so this pins them below
// whatever a subclass appends — LinearBasicDisplay's "Gene glyph" landed after
// "Filter by..." otherwise — while staying above the track's own "Display
// types" at -1000. Shared by all of them so they stay adjacent.
const RECOVERY_PRIORITY = -100

// A named group of mutually-exclusive radio options rendered inline: a
// subHeader followed by the radios, so a settings menu reads as one flat list
// of checkboxes/radios instead of nesting a submenu the user has to hover into.
// The rows come from core's `radioItems` rather than being spelled out here, so
// every radio in every canvas menu keeps the menu open on click — a hand-rolled
// copy is how the "Gene glyph" submenu ended up dismissing the whole track menu
// while its siblings stayed put.
function inlineRadioGroup<T extends string>(
  header: string,
  current: T,
  options: readonly { value: T; label: string; subLabel?: string }[],
  onSelect: (value: T) => void,
): MenuItem[] {
  return [
    { type: 'subHeader' as const, label: header },
    ...radioItems(options, current, onSelect),
  ]
}

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
  // the display's color-key chrome hook, present whenever it has a key at all —
  // the "Show legend" checkbox below is the only way back from the key's own "×"
  colorLegend: CanvasColorLegend | undefined
  setShowOutline: (value: boolean) => void
  setShowLabels: (mode: ShowLabelsMode) => void
}

interface ColorMenuSelf {
  colorByMode: string
  openSetColorDialog: () => void
  openColorByAttributeDialog: () => void
  setFeatureColor: (color: string) => void
}

// `HeightModeMenuModel<LinearBasicDisplayConfig>`, not the bare form: this menu
// pins `displayMode` as well as `heightMode`, and only a concrete schema checks
// that name.
interface FeatureHeightSelf
  extends IStateTreeNode, HeightModeMenuModel<LinearBasicDisplayConfig> {
  displayMode: DisplayMode
  setDisplayMode: (value: DisplayMode) => void
}

interface TrackMenuSelf {
  // The model's own declarations — the count, the undo rows and the group clear
  // are derived from these here, so this menu reads no separately-maintained
  // total and no separately-maintained reset.
  featureNarrowings: () => Reversibles
  featureMarks: () => Reversibles
  showSubmenuMenuItems: () => MenuItem[]
  featureHeightMenuItems: () => MenuItem[]
  colorMenuItems: () => MenuItem[]
  openFilterDialog: () => void
}

// The two recovery rows the base contributes — clearing the highlight boxes and
// unpinning the features held at the top — built from the display's own
// declaration (see `featureMarks`) rather than assembled here. Both are
// reversible state that MARKS rather than hides, so neither joins the filter
// family's count; what they share with it is the row shape and the reason for
// having one at all, which is that both outlive the navigation that created
// them and neither is reachable from the feature once it is off screen.
function featureSetRecoveryMenuItems(self: TrackMenuSelf): MenuItem[] {
  return undoItems(self.featureMarks(), RECOVERY_PRIORITY)
}

// The checkbox rows of the "Show..." submenu. Subclasses append their own via the
// showSubmenuCheckboxItems override; the flat list of all checkboxes is rendered
// before the radio groups so the menu reads top-to-bottom as
// checkboxes-then-radios rather than an interleaved mix.
export function showSubmenuCheckboxItems(self: ShowSubmenuSelf): MenuItem[] {
  const legend = self.colorLegend
  return [
    toggleItem('Show outline', self.showOutline, self.setShowOutline),
    // Only where there is a key to show — a plain feature track declaring no
    // `legend` slot, and a variant track colored by anything but its two preset
    // schemes, have nothing to toggle. Offered at all because the key's own "×"
    // is otherwise a one-way door: it removes the surface it lives on, so a
    // dismissal lasted the whole session with nothing anywhere naming it. Same
    // item and same reasoning as the multi-row painting's.
    ...(legend
      ? [
          showLegendCheckboxItem(!legend.dismissed, () => {
            legend.setDismissed(!legend.dismissed)
          }),
        ]
      : []),
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
        ...promotableRadioItems(
          displayModeOptions,
          self.displayMode,
          mode => {
            self.setDisplayMode(mode)
          },
          mode => makePin(self, 'displayMode', mode),
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
    ...makeShowSubMenu(self.showSubmenuMenuItems()),
    ...self.featureHeightMenuItems(),
    ...self.colorMenuItems(),
    ...featureSetRecoveryMenuItems(self),
    ...canvasFilterMenuItems(self),
  ]
}

// The filter family, in the shape shared with the alignments, LD and
// multi-sample variant displays: one "Filter by... (n)" row that stays a plain
// dialog opener until there is something to recover, then earns its submenu.
// The priority rides the top-level row the builder returns, never the dialog
// opener inside it — there it would sort below the recovery rows it heads.
//
// The count, the recovery rows inside the submenu and what "Clear all filters"
// clears all come from `featureNarrowings`, so a subclass that adds a filter
// (LinearBasicDisplay's "Show only genes") gets all three by appending one
// entry — it used to have to override a count AND a clear and keep them in step.
function canvasFilterMenuItems(self: TrackMenuSelf): MenuItem[] {
  return filterMenuItems({
    narrowings: self.featureNarrowings(),
    onEdit: () => {
      self.openFilterDialog()
    },
    priority: RECOVERY_PRIORITY,
  })
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
