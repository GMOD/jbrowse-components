import { filterMenuItems, undoItems } from '@jbrowse/core/ui/filterMenuItems'
import { radioItems, toggleItem, withHint } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { heightModeMenuItems } from '@jbrowse/display-kit/heightModeMenu'
import HeightIcon from '@mui/icons-material/Height'
import PaletteIcon from '@mui/icons-material/Palette'

import { DISPLAY_MODE_OPTIONS } from '../RenderFeatureDataRPC/displayModes.ts'
import { STRAND_COLOR_JEXL } from '../RenderFeatureDataRPC/featureColors.ts'
import { SHOW_LABELS_OPTIONS } from './showLabelsMode.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { ShowLabelsMode } from './showLabelsMode.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'
import type { HeightModeMenuModel } from '@jbrowse/display-kit/heightModeMenu'

// Every menu level sorts by `priority` and the sort is stable, so this pins
// the recovery rows below whatever a subclass appends and above "Display
// types" at -1000.
const RECOVERY_PRIORITY = -100

// Rows come from core's `radioItems`, so every radio keeps the menu
// open on click; a hand-rolled copy is how the Gene glyph submenu came to
// dismiss the whole menu.
export function inlineRadioGroup<T extends string>(
  header: string,
  current: T,
  options: readonly { value: T; label: string }[],
  onSelect: (value: T) => void,
  hint?: (value: T) => string | undefined,
): MenuItem[] {
  return [
    { type: 'subHeader' as const, label: header },
    ...radioItems(options, current, onSelect).map((item, i) => {
      const { value, label } = options[i]!
      return hint ? { ...item, label: withHint(label, hint(value)) } : item
    }),
  ]
}

// Structural for the same reason as `FeatureMenuSelf`;
interface ShowSubmenuSelf {
  showOutline: boolean
  showLabelsMode: ShowLabelsMode
  displayMode: DisplayMode
  labelsFitHint: string | undefined
  hasLegendKey: boolean
  showLegend: boolean
  setShowLegend: (value: boolean) => void
  setShowOutline: (value: boolean) => void
  setShowLabels: (mode: ShowLabelsMode) => void
}

interface ColorMenuSelf {
  colorByMode: string
  openSetColorDialog: () => void
  openColorByAttributeDialog: () => void
  setFeatureColor: (color?: string) => void
}

interface FeatureHeightSelf extends HeightModeMenuModel {
  displayMode: DisplayMode
  setDisplayMode: (value: DisplayMode) => void
}

interface TrackMenuSelf {
  featureNarrowings: () => Reversibles
  featureMarks: () => Reversibles
  showSubmenuMenuItems: () => MenuItem[]
  featureHeightMenuItems: () => MenuItem[]
  colorMenuItems: () => MenuItem[]
  openFilterDialog: () => void
}

function featureSetRecoveryMenuItems(self: TrackMenuSelf): MenuItem[] {
  return undoItems(self.featureMarks(), RECOVERY_PRIORITY)
}

export function showSubmenuCheckboxItems(self: ShowSubmenuSelf): MenuItem[] {
  return [
    toggleItem('Show outline', self.showOutline, self.setShowOutline),
    ...(self.hasLegendKey ? [legendCheckboxItem(self)] : []),
  ]
}

export function showSubmenuRadioGroups(self: ShowSubmenuSelf): MenuItem[] {
  return inlineRadioGroup(
    'Labels',
    self.showLabelsMode,
    SHOW_LABELS_OPTIONS,
    mode => {
      self.setShowLabels(mode)
    },
    inertLabelHint(self, self.showLabelsMode, self.labelsFitHint),
  )
}

// Collapsed wins over the fit note, since collapsed mode strips labels before
// the ladder sees them; 'none' never carries a hint.
export function inertLabelHint<T extends string>(
  self: { displayMode: DisplayMode },
  current: T,
  fitHint: string | undefined,
) {
  return (value: T) =>
    value !== current || value === 'none'
      ? undefined
      : self.displayMode === 'collapsed'
        ? 'hidden while collapsed'
        : fitHint
}

export function defaultColorItem(self: ColorMenuSelf): MenuItem {
  return {
    label: 'Default',
    type: 'radio' as const,
    checked: self.colorByMode === 'default',
    onClick: () => {
      self.setFeatureColor(undefined)
    },
  }
}

export function colorBySubMenuItems(self: ColorMenuSelf): MenuItem[] {
  return [
    defaultColorItem(self),
    {
      label: 'Solid color...',
      type: 'radio' as const,
      checked: self.colorByMode === 'solid',
      // Opens a dialog, so it dismisses like any other action.
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

// Worded with the generic "feature" rather than `featureNoun`: "Variant
// height" reads like a different setting than "Feature height" when it is the
// same one.
export function featureHeightMenuItems(self: FeatureHeightSelf): MenuItem[] {
  return [
    {
      label: 'Set feature height',
      icon: HeightIcon,
      subMenu: [
        ...radioItems(DISPLAY_MODE_OPTIONS, self.displayMode, mode => {
          self.setDisplayMode(mode)
        }),
        { type: 'subHeader' as const, label: 'Track sizing' },
        ...heightModeMenuItems(self, 'feature'),
      ],
    },
  ]
}

// Reads its sections back off `self` rather than calling the builders
// directly, so a subclass override of any of them lands here.
export function canvasTrackMenuItems(self: TrackMenuSelf): MenuItem[] {
  return [
    ...makeShowSubMenu(self.showSubmenuMenuItems()),
    ...self.featureHeightMenuItems(),
    ...self.colorMenuItems(),
    ...featureSetRecoveryMenuItems(self),
    ...canvasFilterMenuItems(self),
  ]
}

// The priority rides the top-level row the builder returns, never the dialog
// opener inside it, where it would sort below the recovery rows it heads.
function canvasFilterMenuItems(self: TrackMenuSelf): MenuItem[] {
  return filterMenuItems({
    narrowings: self.featureNarrowings(),
    onEdit: () => {
      self.openFilterDialog()
    },
    priority: RECOVERY_PRIORITY,
  })
}

// Reads the choices back off `self`: variants overrides `colorBySubMenuItems`
// and relies on this wrapper picking it up.
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
