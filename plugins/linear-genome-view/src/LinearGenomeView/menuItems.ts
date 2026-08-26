import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { radioItems } from '@jbrowse/core/ui/menuItems'
import {
  SCROLL_ZOOM_HELP,
  SCROLL_ZOOM_LABEL,
} from '@jbrowse/core/ui/scrollZoomLabels'
import {
  getDialogHost,
  getSession,
  isSessionWithAddSessionTrack,
  toLocale,
} from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
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

const TRACK_LABEL_OPTIONS = [
  { value: 'overlapping', label: 'Overlapping' },
  { value: 'offset', label: 'Offset' },
  { value: 'hidden', label: 'Hidden' },
] as const

/**
 * The scroll-to-zoom toggle for the header's zoom menu, where someone already
 * fiddling with zoom will look.
 *
 * The view menu used to carry a copy, on the grounds that it is the one that
 * survives `hideHeader` (MiniControls renders `menuItems()`, not the header's
 * zoom controls). The header now shows the toggle as a button of its own
 * (`ScrollZoomToggle` in `Header.tsx`), and the setting is a session preference
 * reachable from the preferences dialog whatever the header is doing, so the
 * copy bought a row and no reach.
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
 * Zoom all the way out, shared by the view menu and the header's zoom menu —
 * one definition so the two cannot drift in label, and the view menu is the
 * only one of the two that survives `hideHeader`.
 *
 * The zoom menu earns it on the merits: this is the bottom of the same "Zoom
 * out 100x" ladder, and it is where someone already zooming looks.
 *
 * The label is the import form's button text verbatim (`ImportForm.tsx`), which
 * is where most people meet the phrase. No icon: the four-arrows glyph it
 * carried reads as "fullscreen", and nothing else names the same gesture, so a
 * substitute would be decoration rather than a distinction.
 */
export function showAllRegionsMenuItem(self: LinearGenomeViewModel): MenuItem {
  return {
    label: 'Show all regions in assembly',
    onClick: () => {
      self.showAllRegionsInAssembly()
    },
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
    ...(isSessionWithAddSessionTrack(session)
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
    // Top-level rather than under a "Navigation" group: with scroll-to-zoom
    // gone from here the group held two rows, and a popup for two is a click
    // charged for nothing. Not under "Show...", which is visibility toggles.
    showAllRegionsMenuItem(self),
    {
      label: 'Horizontally flip',
      icon: SyncAltIcon,
      onClick: () => {
        self.horizontallyFlip()
      },
    },
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
        // Where a track's name is drawn, and "Hidden" is one of the three
        // answers, so this is a visibility setting like everything above it.
        // Inline under a subheader rather than in a submenu of its own: it was a
        // top-level row for three radios, and nesting it here instead would have
        // put those radios a popup further from the hamburger than they were.
        // The icons went with it — all three rows carried the same one, which
        // told a reader nothing about which to pick.
        { type: 'subHeader', label: 'Track labels' },
        ...radioItems(
          TRACK_LABEL_OPTIONS,
          self.effectiveTrackLabels,
          setting => {
            self.setTrackLabels(setting)
          },
        ),
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
  // `coord` is already 1-based (`regionCoord` = `regionBase0` + 1), so the left
  // end needs no increment, and the right end is the exclusive bound — the base
  // one past the selection. Incrementing the left and taking the right raw
  // named a range shifted one base right of the one `Zoom to region` navigates
  // to, from the same two offsets.
  const leftCoord = toLocaleRounded(leftOffset?.coord ?? 0)
  const rightCoord = toLocaleRounded((rightOffset?.coord ?? 1) - 1)
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
        getDialogHost(self).queueDialog(handleClose => [
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
  // `coord` is 1-based, so it is the label as it stands. `centerAt` goes
  // through `bpToPx`, which takes the 0-based BED-style coord — the two
  // conventions meet here and nowhere else.
  const locString = `${refName}:${toLocaleRounded(coord)}`
  const coord0 = coord - 1
  return [
    {
      label: 'Center view here',
      icon: CenterFocusStrongIcon,
      onClick: () => {
        self.centerAt(coord0, refName)
      },
    },
    {
      label: 'Zoom to base level',
      icon: ZoomInIcon,
      onClick: () => {
        self.centerAt(coord0, refName)
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
