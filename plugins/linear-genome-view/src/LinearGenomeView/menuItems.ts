import {
  Highlighter,
  TrackSelector as TrackSelectorIcon,
} from '@jbrowse/core/ui/Icons'
import { radioItems } from '@jbrowse/core/ui/menuItems'
import {
  assembleLocStrings,
  getDialogHost,
  getSession,
  isSessionWithAddSessionTrack,
  toLocale,
} from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { copyText } from '@jbrowse/core/util/copyText'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LabelIcon from '@mui/icons-material/Label'
import LaunchIcon from '@mui/icons-material/Launch'
import LayersIcon from '@mui/icons-material/Layers'
import LayersClearIcon from '@mui/icons-material/LayersClear'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SearchIcon from '@mui/icons-material/Search'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInIcon from '@mui/icons-material/ZoomIn'

import { closeUpHost } from './closeUps.ts'
import {
  AddCloseUpDialog,
  ExportSvgDialog,
  GetSequenceDialog,
  RegionWidthEditorDialog,
  ReturnToImportFormDialog,
  SequenceSearchDialog,
} from './lazyDialogs.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type { BpOffset } from './types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const TRACK_LABEL_OPTIONS = [
  { value: 'overlapping', label: 'Overlapping' },
  { value: 'offset', label: 'Offset' },
  { value: 'hidden', label: 'Hidden' },
] as const

function showAllRegionsMenuItem(self: LinearGenomeViewModel): MenuItem {
  return {
    label: 'Show all regions in assembly',
    onClick: () => {
      self.showAllRegionsInAssembly()
    },
  }
}

export function zoomMenuItems(self: LinearGenomeViewModel): MenuItem[] {
  return [
    ...[10, 50, 100].map(r => ({
      label: `Zoom in ${r}x`,
      onClick: () => {
        self.zoom(self.bpPerPx / r)
      },
    })),
    ...[10, 50, 100].map(r => ({
      label: `Zoom out ${r}x`,
      onClick: () => {
        self.zoom(self.bpPerPx * r)
      },
    })),
    showAllRegionsMenuItem(self),
    {
      label: 'Custom zoom',
      onClick: () => {
        getDialogHost(self).queueDialog(handleClose => [
          RegionWidthEditorDialog,
          { model: self, handleClose },
        ])
      },
    },
  ]
}

export function buildHighlightsSubMenuItems(
  self: LinearGenomeViewModel,
): MenuItem[] {
  const session = getSession(self)
  return [
    {
      label: 'Show highlights',
      type: 'checkbox',
      checked: session.highlightsVisible,
      onClick: () => {
        session.setHighlightsVisible(!session.highlightsVisible)
      },
    },
    {
      label: 'Show highlight labels',
      type: 'checkbox',
      checked: self.labelsVisible,
      onClick: () => {
        self.setLabelsVisible(!self.labelsVisible)
      },
    },
  ]
}

/**
 * Build the main view menu items. A row stacked in another view has no import
 * form of its own, so only a top-level view offers the way back to one.
 */
export function buildMenuItems(self: LinearGenomeViewModel): MenuItem[] {
  if (!self.hasDisplayedRegions) {
    return []
  }
  const session = getSession(self)
  const host = closeUpHost(self)
  const menuItems: MenuItem[] = [
    {
      label: 'Open track selector',
      onClick: () => {
        self.activateTrackSelector()
      },
      icon: TrackSelectorIcon,
    },
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
    ...(self.isTopLevelView
      ? [
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
        ]
      : []),
    ...(host
      ? [
          {
            label: 'Remove close-up view',
            icon: LayersClearIcon,
            onClick: () => {
              host.removeCloseUp(self)
            },
          },
        ]
      : []),
    {
      label: 'Horizontally flip',
      icon: SyncAltIcon,
      onClick: () => {
        self.horizontallyFlip()
      },
    },
    {
      label: 'Show...',
      icon: VisibilityIcon,
      subMenu: [
        showAllRegionsMenuItem(self),
        {
          label: 'Show ruler only',
          type: 'checkbox',
          checked: self.scalebarOnly,
          onClick: () => {
            self.setScalebarOnly(!self.scalebarOnly)
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
          label: 'Show header overview',
          type: 'checkbox',
          checked: !self.hideHeaderOverview,
          onClick: () => {
            self.setHideHeaderOverview(!self.hideHeaderOverview)
          },
          disabled: self.hideHeader,
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
        {
          label: 'Show center line',
          type: 'checkbox',
          checked: self.showCenterLine,
          onClick: () => {
            self.setShowCenterLine(!self.showCenterLine)
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
        {
          label: 'Show track outlines',
          type: 'checkbox',
          checked: self.showTrackOutlines,
          onClick: () => {
            self.setShowTrackOutlines(!self.showTrackOutlines)
          },
        },
        {
          label: 'Show no tracks active button',
          type: 'checkbox',
          checked: !self.hideNoTracksActive,
          onClick: () => {
            self.setHideNoTracksActive(!self.hideNoTracksActive)
          },
        },
        { type: 'subHeader', label: 'Sequence' },
        {
          label: 'Show CDS reading frame colors',
          type: 'checkbox',
          checked: self.colorByCDS,
          onClick: () => {
            self.setColorByCDS(!self.colorByCDS)
          },
        },
        {
          label: 'Show amino acids when zoomed in',
          type: 'checkbox',
          checked: self.showAminoAcids,
          onClick: () => {
            self.setShowAminoAcids(!self.showAminoAcids)
          },
        },
      ],
    },
    {
      label: 'Highlights',
      icon: Highlighter,
      subMenu: self.highlightsSubMenuItems(),
    },
    {
      label: 'Track labels',
      icon: LabelIcon,
      subMenu: radioItems(
        TRACK_LABEL_OPTIONS,
        self.effectiveTrackLabels,
        setting => {
          self.setTrackLabels(setting)
        },
      ),
    },
  ]

  return menuItems
}

/**
 * Build rubberband selection menu items. What a selection can open collects
 * under one "Launch" submenu, which sorts last, below any row a plugin appends
 * to the menu itself: a close-up view first, then `launchItems`, the
 * plugin-supplied ones (`rubberBandLaunchMenuItems()`).
 *
 * A close-up is offered from HERE and nowhere else, because a drag is what the
 * feature was always asking for and a menu item could not: the close-up shows
 * one span of one place, and this is the gesture that names both. From the view
 * menu it could only guess — a tenth of the middle, which is a span nobody
 * picked.
 *
 * Only a view of its own offers it, which `isTopLevelView` is the whole of. A
 * row of a comparative stack is already part of somebody's figure: the synteny
 * ribbons and the breakpoint split panels are placed against each row's own
 * height, and those views' exports draw one row per view, so a close-up grown
 * there walks the ribbons off their rows and is dropped from the picture
 * without a word. A close-up, living under a view rather than under the
 * session, is not a top-level view either.
 */
export function buildRubberBandMenuItems(
  self: LinearGenomeViewModel,
  launchItems: MenuItem[],
): MenuItem[] {
  // captured once here and used by the items below rather than re-read inside
  // their onClick: the menu's onClose runs first and may release the selection,
  // which would leave the click reading undefined and silently doing nothing
  const { leftOffset, rightOffset } = self
  // The same regions `Get sequence` fetches and `Zoom to region` navigates to,
  // named the way the header names what it is showing. Arithmetic on the two
  // offsets' `coord` cannot do this: `coord` is the POINT convention, so on a
  // reversed region it names neither the base painted at the pixel nor the ends
  // in ascending order, and a `leftRef === rightRef` test calls a selection
  // crossing a collapsed intron one range when it is two.
  const rangeString = assembleLocStrings(
    self.getSelectedRegions(leftOffset, rightOffset),
  )
  const launch: MenuItem[] = [
    ...(self.isTopLevelView
      ? [
          {
            label: 'Close-up view',
            icon: LayersIcon,
            helpText:
              'A zoomed-in copy of this view, opened below its tracks. It stays centred on this view and pans with it.',
            onClick: () => {
              getDialogHost(self).queueDialog(handleClose => [
                AddCloseUpDialog,
                {
                  model: self,
                  leftOffset,
                  rightOffset,
                  handleClose: () => {
                    handleClose()
                    self.setOffsets()
                  },
                },
              ])
            },
          },
        ]
      : []),
    ...launchItems,
  ]

  return [
    {
      label: 'Zoom to region',
      icon: ZoomInIcon,
      onClick: () => {
        self.moveTo(leftOffset, rightOffset)
      },
    },
    {
      label: 'Get sequence',
      icon: MenuOpenIcon,
      onClick: () => {
        const regions = self.getSelectedRegions(leftOffset, rightOffset)
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
    {
      label: 'Highlight region',
      icon: Highlighter,
      onClick: () => {
        const [region] = self.getSelectedRegions(leftOffset, rightOffset)
        if (region) {
          getSession(self).addHighlight(region)
        }
      },
    },
    ...(launch.length
      ? [
          {
            label: 'Launch',
            icon: LaunchIcon,
            type: 'subMenu' as const,
            priority: -1000,
            subMenu: launch,
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
  const { refName, start, end, reversed, offset } = clickOffset
  if (refName === undefined || start === undefined || end === undefined) {
    return []
  }
  // `basePaintedAt`, not `coord`: `coord` is the point convention, which on a
  // reversed region names the base one PAST the one under the pointer — and at
  // the region's first column names a base off the end of the contig entirely.
  // Forward the two agree, so this only ever moves the reversed answer.
  //
  // The result is 0-based, which is what `centerAt` takes (it goes through
  // `bpToPx`); the label adds the 1 back.
  const coord0 = basePaintedAt({ start, end, reversed }, offset)
  const locString = `${refName}:${toLocale(coord0 + 1)}`
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
