import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
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
import LaunchIcon from '@mui/icons-material/Launch'
import LayersIcon from '@mui/icons-material/Layers'
import LayersClearIcon from '@mui/icons-material/LayersClear'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SearchIcon from '@mui/icons-material/Search'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInIcon from '@mui/icons-material/ZoomIn'

import { detailLevelHost } from './detailLevels.ts'
import {
  AddDetailLevelDialog,
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

/**
 * Zoom all the way out — the bottom of the same "Zoom out 100x" ladder it sits
 * under.
 *
 * The label is the import form's button text verbatim (`ImportForm.tsx`), which
 * is where most people meet the phrase. No icon: the four-arrows glyph it
 * carried reads as "fullscreen", and nothing else names the same gesture, so a
 * substitute would be decoration rather than a distinction.
 */
function showAllRegionsMenuItem(self: LinearGenomeViewModel): MenuItem {
  return {
    label: 'Show all regions in assembly',
    onClick: () => {
      self.showAllRegionsInAssembly()
    },
  }
}

/**
 * A view offers to open a detail level under itself; a level offers to go.
 * Adding stops once the closest level — or this view when it has none — is
 * already at base level, since there is nothing left to zoom into.
 *
 * Only a view of its own offers to add one. A row of a comparative stack is
 * already part of somebody's figure: the synteny ribbons and the breakpoint
 * split panels are placed against each row's own height, and those views'
 * exports draw one row per view, so a level grown there walks the ribbons off
 * their rows and is dropped from the picture without a word. A level itself is
 * not a top-level view either, hence the host check first — that is the menu
 * that takes it away again.
 */
function addDetailLevelMenuItem(self: LinearGenomeViewModel): MenuItem[] {
  if (!self.isTopLevelView || detailLevelHost(self)) {
    return []
  }
  const closest = self.detailLevelViews.at(-1) ?? self
  return [
    {
      label: 'Add detail level',
      icon: LayersIcon,
      // `bpPerPx > 0` first: it is the unmeasured sentinel for a view that has
      // not been laid out yet, and comparing it says nothing
      disabled: closest.bpPerPx > 0 && closest.bpPerPx <= closest.minBpPerPx,
      onClick: () => {
        getDialogHost(self).queueDialog(handleClose => [
          AddDetailLevelDialog,
          { model: self, handleClose },
        ])
      },
    },
  ]
}

/**
 * The zoom ladder, shared by the header's zoom button and the view menu's
 * "Zoom" — one definition so the two cannot drift, and the view menu is the
 * only one of the two that survives `hideHeader`.
 *
 * A detail level belongs here rather than beside "Export SVG": what it does is
 * zoom in, and what it costs is the view you were reading. Somebody who wants
 * both looks where the zooming is.
 */
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
    ...addDetailLevelMenuItem(self),
  ]
}

/**
 * Build the main view menu items. A row stacked in another view has no import
 * form of its own, so only a top-level view offers the way back to one.
 *
 * Four actions, a Zoom group and a Show group. The four are what people open
 * this menu to do — pick tracks, take a picture, search the sequence, start
 * over — and the once-a-session settings that used to sit beside them are a
 * popup away instead of in front of every reader every time.
 */
export function buildMenuItems(self: LinearGenomeViewModel): MenuItem[] {
  if (!self.hasDisplayedRegions) {
    return []
  }
  const session = getSession(self)
  const host = detailLevelHost(self)
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
    // The one row a detail level adds, and the only one of its own it needs.
    // Top-level rather than under Zoom with the item that made it: a level is
    // a second panel on the page, and taking a panel away is not a zoom.
    ...(host
      ? [
          {
            label: 'Remove detail level',
            icon: LayersClearIcon,
            onClick: () => {
              host.removeDetailLevel(self)
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
      label: 'Zoom',
      icon: ZoomInIcon,
      subMenu: zoomMenuItems(self),
    },
    {
      label: 'Show...',
      icon: VisibilityIcon,
      subMenu: [
        // Collapsing a row is about height and what it hides is the tracks, so
        // it is the widest of the visibility answers and heads them. A checkbox
        // rather than the pair of labels it was: "Collapse to ruler" turning
        // into "Expand tracks" names the current state nowhere, and among
        // checkboxes there is no room for the trick anyway.
        {
          label: 'Collapse to ruler',
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
        // The two answers to what the sequence draws as: one colours the
        // codons, the other spells them out. Both lost the palette icon they
        // used to carry — nothing else in this list has one.
        { type: 'subHeader', label: 'Sequence' },
        {
          label: 'Color CDS by reading frame',
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
