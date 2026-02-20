import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  getSession,
  isSessionWithAddTracks,
  toLocale,
} from '@jbrowse/core/util'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LabelIcon from '@mui/icons-material/Label'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SearchIcon from '@mui/icons-material/Search'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInIcon from '@mui/icons-material/ZoomIn'

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
 * Modifies view menu action onClick to apply to all tracks of same type
 */
export function rewriteOnClicks(
  self: LinearGenomeViewModel,
  trackType: string,
  viewMenuActions: MenuItem[],
) {
  for (const action of viewMenuActions) {
    if ('subMenu' in action) {
      rewriteOnClicks(self, trackType, action.subMenu)
    }
    if ('onClick' in action) {
      const holdOnClick = action.onClick
      action.onClick = (...args: unknown[]) => {
        for (const track of self.tracks) {
          if (track.type === trackType) {
            holdOnClick.apply(track, [track, ...args])
          }
        }
      }
    }
  }
}

/**
 * Build the main view menu items
 */
export function buildMenuItems(self: LinearGenomeViewModel): MenuItem[] {
  if (!self.hasDisplayedRegions) {
    return []
  }
  const { canShowCytobands, showCytobands } = self
  const session = getSession(self)
  const menuItems: MenuItem[] = [
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
      onClick: self.activateTrackSelector,
      icon: TrackSelectorIcon,
    },
    {
      label: 'Horizontally flip',
      icon: SyncAltIcon,
      onClick: self.horizontallyFlip,
    },
    {
      label: 'Color by CDS and draw amino acids',
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
          onClick: self.showAllRegionsInAssembly,
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
          label: 'Show guidelines',
          type: 'checkbox',
          checked: self.showGridlines,
          onClick: () => {
            self.setShowGridlines(!self.showGridlines)
          },
        },
        ...(canShowCytobands
          ? [
              {
                label: 'Show ideogram',
                type: 'checkbox' as const,
                checked: self.showCytobands,
                onClick: () => {
                  self.setShowCytobands(!showCytobands)
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
          checked: self.trackLabelsSetting === 'overlapping',
          onClick: () => {
            self.setTrackLabels('overlapping')
          },
        },
        {
          label: 'Offset',
          icon: VisibilityIcon,
          type: 'radio',
          checked: self.trackLabelsSetting === 'offset',
          onClick: () => {
            self.setTrackLabels('offset')
          },
        },
        {
          label: 'Hidden',
          icon: VisibilityIcon,
          type: 'radio',
          checked: self.trackLabelsSetting === 'hidden',
          onClick: () => {
            self.setTrackLabels('hidden')
          },
        },
        {
          label: 'Separate',
          icon: VisibilityIcon,
          type: 'radio',
          checked: self.trackLabelsSetting === 'separate',
          onClick: () => {
            self.setTrackLabels('separate')
          },
        },
      ],
    },
  ]

  // add track's view level menu options
  for (const [key, value] of self.trackTypeActions.entries()) {
    if (value.length) {
      menuItems.push(
        {
          type: 'divider',
        },
        {
          type: 'subHeader',
          label: key,
        },
      )
      for (const action of value) {
        menuItems.push(action)
      }
    }
  }

  return menuItems
}

/**
 * Build rubberband selection menu items
 */
export function buildRubberBandMenuItems(
  self: LinearGenomeViewModel,
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
        getSession(self).queueDialog(handleClose => [
          GetSequenceDialog,
          {
            model: self,
            handleClose,
          },
        ])
      },
    },
    {
      label: 'Copy range',
      icon: ContentCopyIcon,
      onClick: async () => {
        const { default: copy } = await import('copy-to-clipboard')
        copy(rangeString)
      },
    },
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
      onClick: async () => {
        const { default: copy } = await import('copy-to-clipboard')
        copy(locString)
      },
    },
  ]
}
