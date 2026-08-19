import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  SCROLL_ZOOM_HELP,
  SCROLL_ZOOM_LABEL,
} from '@jbrowse/core/ui/scrollZoomLabels'
import {
  getSession,
  isSessionWithAddTracks,
  toLocale,
} from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LabelIcon from '@mui/icons-material/Label'
import LaunchIcon from '@mui/icons-material/Launch'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SearchIcon from '@mui/icons-material/Search'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'

import {
  ExportSvgDialog,
  GetSequenceDialog,
  ReturnToImportFormDialog,
  SequenceSearchDialog,
} from './lazyDialogs.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type { BpOffset } from './types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

function toLocaleRounded(n: number) {
  return toLocale(Math.round(n))
}

/**
 * The scroll-to-zoom toggle, shared by the view menu and the header's zoom menu
 * so the two can't drift apart in label or wording.
 *
 * Both places earn it. The zoom menu is where someone already fiddling with
 * zoom will look, and it is where this belongs on the merits; the view menu is
 * the only one of the two that survives `hideHeader`, since MiniControls
 * renders `menuItems()` and not the header's zoom controls.
 *
 * Writes a *session* preference, not view state — every wheel-zoom view in the
 * app follows it (see BaseSession's `scrollZoom`).
 */
export function scrollZoomMenuItem(self: LinearGenomeViewModel): MenuItem {
  return {
    label: SCROLL_ZOOM_LABEL,
    type: 'checkbox',
    checked: self.scrollZoom,
    icon: ZoomInMapIcon,
    onClick: () => {
      self.setScrollZoom(!self.scrollZoom)
    },
    helpText: SCROLL_ZOOM_HELP,
  }
}

/**
 * Build the main view menu items
 */
export function buildMenuItems(self: LinearGenomeViewModel): MenuItem[] {
  if (!self.hasDisplayedRegions) {
    return []
  }
  const session = getSession(self)
  const menuItems: MenuItem[] = [
    {
      label: self.scalebarOnly ? 'Expand tracks' : 'Collapse to ruler',
      icon: self.scalebarOnly ? ExpandMoreIcon : ExpandLessIcon,
      onClick: () => {
        self.setScalebarOnly(!self.scalebarOnly)
      },
    },
    {
      label: 'Return to import form',
      onClick: () => {
        session.queueDialog(handleClose => [
          ReturnToImportFormDialog,
          {
            model: self,
            handleClose,
          },
        ])
      },
      icon: FolderOpenIcon,
    },
    ...(isSessionWithAddTracks(session)
      ? [
          {
            label: 'Sequence search',
            icon: SearchIcon,
            onClick: () => {
              session.queueDialog(handleClose => [
                SequenceSearchDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
        ]
      : []),
    {
      label: 'Export SVG',
      icon: PhotoCameraIcon,
      onClick: () => {
        session.queueDialog(handleClose => [
          ExportSvgDialog,
          {
            model: self,
            handleClose,
          },
        ])
      },
    },
    {
      label: 'Open track selector',
      onClick: () => {
        self.activateTrackSelector()
      },
      icon: TrackSelectorIcon,
    },
    {
      label: 'Horizontally flip',
      icon: SyncAltIcon,
      onClick: () => {
        self.horizontallyFlip()
      },
    },
    // top level, not under "Show...": that submenu is visibility toggles, and
    // this is a navigation gesture — the label was also the only thing naming
    // it, so it was findable only by someone who already knew it existed
    scrollZoomMenuItem(self),
    {
      label: 'Color CDS by reading frame',
      type: 'checkbox',
      checked: self.colorByCDS,
      icon: PaletteIcon,
      onClick: () => {
        self.setColorByCDS(!self.colorByCDS)
      },
    },
    {
      label: 'Show...',
      icon: VisibilityIcon,
      subMenu: [
        {
          label: 'Show all regions in assembly',
          onClick: () => {
            self.showAllRegionsInAssembly()
          },
        },
        {
          label: 'Show center line',
          type: 'checkbox',
          checked: self.showCenterLine,
          onClick: () => {
            self.setShowCenterLine(!self.showCenterLine)
          },
        },
        {
          label: 'Show header',
          type: 'checkbox',
          checked: !self.hideHeader,
          // opts out of the checkbox "stay open" default: with the header
          // hidden these same items are reachable from MiniControls, which this
          // row unmounts — leaving the menu anchored to a removed node
          keepMenuOpen: false,
          onClick: () => {
            self.setHideHeader(!self.hideHeader)
          },
        },

        {
          label: 'Show track outlines',
          type: 'checkbox',
          checked: self.showTrackOutlines,
          onClick: () => {
            self.setShowTrackOutlines(!self.showTrackOutlines)
          },
        },
        {
          label: 'Show header overview',
          type: 'checkbox',
          checked: !self.hideHeaderOverview,
          onClick: () => {
            self.setHideHeaderOverview(!self.hideHeaderOverview)
          },
          disabled: self.hideHeader,
        },
        {
          label: 'Show no tracks active button',
          type: 'checkbox',
          checked: !self.hideNoTracksActive,
          onClick: () => {
            self.setHideNoTracksActive(!self.hideNoTracksActive)
          },
        },
        {
          // no icon: the palette it used to carry sat directly against the
          // color-by-CDS one above it, which is the reason it moved here
          label: 'Show amino acids when zoomed in',
          type: 'checkbox',
          checked: self.showAminoAcids,
          onClick: () => {
            self.setShowAminoAcids(!self.showAminoAcids)
          },
        },
        {
          label: 'Show guidelines',
          type: 'checkbox',
          checked: self.showGridlines,
          onClick: () => {
            self.setShowGridlines(!self.showGridlines)
          },
        },
        ...(self.canShowCytobands
          ? [
              {
                label: 'Show ideogram',
                type: 'checkbox' as const,
                checked: self.showCytobands,
                onClick: () => {
                  self.setShowCytobands(!self.showCytobands)
                },
              },
            ]
          : []),
      ],
    },
    {
      label: 'Track labels',
      icon: LabelIcon,
      subMenu: [
        {
          label: 'Overlapping',
          icon: VisibilityIcon,
          type: 'radio',
          checked: self.effectiveTrackLabels === 'overlapping',
          onClick: () => {
            self.setTrackLabels('overlapping')
          },
        },
        {
          label: 'Offset',
          icon: VisibilityIcon,
          type: 'radio',
          checked: self.effectiveTrackLabels === 'offset',
          onClick: () => {
            self.setTrackLabels('offset')
          },
        },
        {
          label: 'Hidden',
          icon: VisibilityIcon,
          type: 'radio',
          checked: self.effectiveTrackLabels === 'hidden',
          onClick: () => {
            self.setTrackLabels('hidden')
          },
        },
      ],
    },
  ]

  return menuItems
}

/**
 * Build rubberband selection menu items. `launchItems` are the plugin-supplied
 * things a selection can start (`rubberBandLaunchMenuItems()`); they collect
 * under one "Launch" submenu so the menu stays three actions plus a group
 * however many plugins are loaded, and vanish entirely when none apply.
 */
export function buildRubberBandMenuItems(
  self: LinearGenomeViewModel,
  launchItems: MenuItem[],
): MenuItem[] {
  const { leftOffset, rightOffset } = self
  const leftRef = leftOffset?.refName ?? ''
  const rightRef = rightOffset?.refName ?? ''
  const leftCoord = toLocaleRounded((leftOffset?.coord ?? 0) + 1)
  const rightCoord = toLocaleRounded(rightOffset?.coord ?? 0)
  const rangeString =
    leftRef === rightRef
      ? `${leftRef}:${leftCoord}-${rightCoord}`
      : `${leftRef}:${leftCoord}..${rightRef}:${rightCoord}`

  return [
    {
      label: 'Zoom to region',
      icon: ZoomInIcon,
      onClick: () => {
        self.moveTo(self.leftOffset, self.rightOffset)
      },
    },
    {
      label: 'Get sequence',
      icon: MenuOpenIcon,
      onClick: () => {
        const regions = self.getSelectedRegions(
          self.leftOffset,
          self.rightOffset,
        )
        getSession(self).queueDialog(handleClose => [
          GetSequenceDialog,
          {
            model: self,
            regions,
            handleClose: () => {
              handleClose()
              self.setOffsets()
            },
          },
        ])
      },
    },
    {
      label: 'Copy range',
      icon: ContentCopyIcon,
      onClick: () => {
        void copyText(self, rangeString, 'range')
      },
    },
    ...(launchItems.length
      ? [
          {
            label: 'Launch',
            icon: LaunchIcon,
            type: 'subMenu' as const,
            subMenu: launchItems,
          },
        ]
      : []),
  ]
}

/**
 * Build rubberband click menu items (single click on rubberband area)
 */
export function buildRubberbandClickMenuItems(
  self: LinearGenomeViewModel,
  clickOffset: BpOffset,
): MenuItem[] {
  const { coord, refName } = clickOffset
  if (coord === undefined || refName === undefined) {
    return []
  }
  const locString = `${refName}:${toLocaleRounded(coord + 1)}`
  return [
    {
      label: 'Center view here',
      icon: CenterFocusStrongIcon,
      onClick: () => {
        self.centerAt(coord, refName)
      },
    },
    {
      label: 'Zoom to base level',
      icon: ZoomInIcon,
      onClick: () => {
        self.centerAt(coord, refName)
        self.zoomTo(self.minBpPerPx)
      },
    },
    {
      label: `Copy coordinate (${locString})`,
      icon: ContentCopyIcon,
      onClick: () => {
        void copyText(self, locString, 'coordinate')
      },
    },
  ]
}
