import { filterMenuItems, undoItems } from '@jbrowse/core/ui/filterMenuItems'
import {
  TRACK_MENU_PRIORITY,
  radioItems,
  toggleItem,
  withHint,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import {
  colorByMenuItem,
  colorFieldRows,
} from '@jbrowse/display-kit/colorByMenu'
import {
  groupByRadioMenuItem,
  hiddenGroupsItems,
  resetSectionOrderItems,
} from '@jbrowse/display-kit/groupByMenu'
import { heightModeMenuItems } from '@jbrowse/display-kit/heightModeMenu'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import HeightIcon from '@mui/icons-material/Height'

import { DISPLAY_MODE_OPTIONS } from '../RenderFeatureDataRPC/displayModes.ts'
import { colorsWithGrouping } from './groupByColor.ts'
import { SHOW_LABELS_OPTIONS } from './showLabelsMode.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureFacet } from './facet.ts'
import type { ShowLabelsMode } from './showLabelsMode.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'
import type { HiddenGroupsModel } from '@jbrowse/display-kit/groupByMenu'
import type { HeightModeMenuModel } from '@jbrowse/display-kit/heightModeMenu'
import type { PlotDisplay } from '@jbrowse/display-kit/plotMenu'

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
interface ShowSubmenuSelf extends HiddenGroupsModel, FacetSelf {
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

interface FeatureHeightSelf extends HeightModeMenuModel {
  displayMode: DisplayMode
  setDisplayMode: (value: DisplayMode) => void
}

interface FacetSelf {
  facet: FeatureFacet | undefined
  setFacetDomain: (domain: readonly string[]) => void
}

interface GroupByMenuSelf {
  facet: FeatureFacet | undefined
  colorSetting: { value?: string }
  colorField: string | undefined
  openGroupByDialog: () => void
  applyGroupBy: (field: string | undefined, colorByGroup: boolean) => void
}

interface TrackMenuSelf extends GroupByMenuSelf, PlotDisplay {
  featureNarrowings: () => Reversibles
  featureMarks: () => Reversibles
  showSubmenuMenuItems: () => MenuItem[]
  featureHeightMenuItems: () => MenuItem[]
  colorMenuItems: () => MenuItem[]
  filterSubMenuItems: () => MenuItem[]
  openFilterDialog: () => void
}

const ATTRIBUTE = 'attribute'

export function groupByMenuItems(self: GroupByMenuSelf): MenuItem[] {
  const field = self.facet?.field
  const attribute = field === STRAND_FIELD ? undefined : field
  return [
    groupByRadioMenuItem({
      current:
        field === STRAND_FIELD ? field : attribute ? ATTRIBUTE : undefined,
      options: [{ type: STRAND_FIELD, label: 'Strand' }],
      onSelect: strand => {
        self.applyGroupBy(
          strand,
          colorsWithGrouping(
            self.colorSetting.value,
            self.colorField ?? '',
            strand,
          ),
        )
      },
      onNone: () => {
        self.applyGroupBy(undefined, false)
      },
      extra: [
        {
          type: ATTRIBUTE,
          label: attribute ? `Attribute (${attribute})...` : 'Attribute...',
          onClick: () => {
            self.openGroupByDialog()
          },
        },
      ],
    }),
  ]
}

function featureSetRecoveryMenuItems(self: TrackMenuSelf): MenuItem[] {
  return undoItems(self.featureMarks(), TRACK_MENU_PRIORITY.recovery)
}

export function showSubmenuCheckboxItems(self: ShowSubmenuSelf): MenuItem[] {
  const { facet } = self
  return [
    toggleItem('Outline', self.showOutline, self.setShowOutline),
    ...hiddenGroupsItems(self),
    ...resetSectionOrderItems(
      facet && {
        domain: facet.domain,
        setDomain: domain => {
          self.setFacetDomain(domain)
        },
      },
    ),
  ]
}

// A divider keeps the legend from reading as the last radio group's option.
export function showSubmenuLegendItems(self: ShowSubmenuSelf): MenuItem[] {
  return self.hasLegendKey
    ? [{ type: 'divider' }, legendCheckboxItem(self)]
    : []
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

export function colorBySubMenuItems(
  self: Parameters<typeof colorFieldRows>[0],
): MenuItem[] {
  return colorFieldRows(self, [
    {
      label: 'Strand',
      field: STRAND_FIELD,
      checked: self.colorByMode === 'strand',
    },
  ])
}

// Worded with the generic "feature" rather than `featureNoun`: "Variant
// height" reads like a different setting than "Feature height" when it is the
// same one.
export function featureHeightMenuItems(self: FeatureHeightSelf): MenuItem[] {
  return [
    {
      label: 'Feature height',
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
    ...groupByMenuItems(self),
    ...editPlotMenuItems(self),
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
    subItems: self.filterSubMenuItems(),
    priority: TRACK_MENU_PRIORITY.recovery,
  })
}

// Reads the choices back off `self`: variants overrides `colorBySubMenuItems`
// and relies on this wrapper picking it up.
export function colorMenuItems(self: {
  colorBySubMenuItems: () => MenuItem[]
}): MenuItem[] {
  return [colorByMenuItem({ blocks: [{ rows: self.colorBySubMenuItems() }] })]
}
