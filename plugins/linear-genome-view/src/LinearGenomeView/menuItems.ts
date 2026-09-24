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
import {
  basePaintedAt,
  computeMoveToLayout,
} from '@jbrowse/core/util/Base1DUtils'
import { copyText } from '@jbrowse/core/util/copyText'
import { renameIds } from '@jbrowse/core/util/types/mst'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LabelIcon from '@mui/icons-material/Label'
import LaunchIcon from '@mui/icons-material/Launch'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SearchIcon from '@mui/icons-material/Search'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInIcon from '@mui/icons-material/ZoomIn'

import {
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
    ...(self.isTopLevelView && self.tracks.length
      ? [
          {
            label: 'Fit tracks to window',
            icon: FitScreenIcon,
            disabled: !self.scrollPortExcess,
            onClick: () => {
              self.fitTracksToWindow()
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
 * Open a copy of the view, tracks and their settings included, framed on the
 * span between two offsets. The same copy as the view menu's "Copy view", and
 * nothing links it back to the original.
 */
export function openSpanInNewView(
  view: LinearGenomeViewModel,
  start?: BpOffset,
  end?: BpOffset,
) {
  if (!start || !end) {
    return undefined
  }
  const { bpPerPx, offsetPx } = computeMoveToLayout(view, start, end)
  return getSession(view).addView(view.type, {
    ...renameIds(getSnapshot(view)),
    windowWidthBp: bpPerPx * view.width,
    windowStartBp: offsetPx * bpPerPx,
  })
}

/**
 * Build rubberband selection menu items. What a selection can open collects
 * under one "Launch" submenu, which sorts last, below any row a plugin appends
 * to the menu itself: a new linear genome view of the span first, then
 * `launchItems`, the plugin-supplied ones (`rubberBandLaunchMenuItems()`).
 *
 * The new view is a copy of this one, so only a top-level view offers it: a row
 * of a comparative view carries that view's framing, such as a hidden header.
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
            label: 'Linear genome view',
            icon: OpenInNewIcon,
            helpText:
              'A new view of this span, with the same tracks. It scrolls and zooms on its own.',
            onClick: () => {
              openSpanInNewView(self, leftOffset, rightOffset)
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
  const { refName, start, end, reversed, offset, index } = clickOffset
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
        self.centerAt(coord0, refName, index)
      },
    },
    {
      label: 'Zoom to base level',
      icon: ZoomInIcon,
      onClick: () => {
        self.zoomTo(self.minBpPerPx)
        self.centerAt(coord0, refName, index)
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
