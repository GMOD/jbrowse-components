import { withSubHeader } from '@jbrowse/core/ui/menuItems'
import { rowLabels } from '@jbrowse/plugin-linear-genome-view'
import { trackSubMenuItem } from '@jbrowse/synteny-core'
import CropFreeIcon from '@mui/icons-material/CropFree'
import LineStyleIcon from '@mui/icons-material/LineStyle'
import RemoveIcon from '@mui/icons-material/Remove'
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap'

import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackActionView } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LodTier, MenuTrack } from '@jbrowse/synteny-core'

// The sections of the LinearSyntenyView menus. Each returns [] when it does not
// apply, and takes the structural slice it reads rather than the whole view
// model, so the model chain passes `self` with no cast.

interface RemoveRowModel {
  views: { assemblyNames: string[] }[]
  removeRow: (idx: number) => void
}

// A two-row view has nothing to remove without collapsing to a single genome.
export function removeRowMenuItems(model: RemoveRowModel): MenuItem[] {
  return model.views.length > 2
    ? [
        {
          label: 'Remove row',
          icon: RemoveIcon,
          subMenu: rowLabels(model.views).map((label, idx) => ({
            label,
            onClick: () => {
              model.removeRow(idx)
            },
          })),
        },
      ]
    : []
}

interface NavigationModel {
  canSquareView: boolean
  squareView: () => void
  showAllRegions: () => void
}

/**
 * The two zoom commands that act on every row at once. Square view after Show
 * whole genome draws the genomes to scale.
 */
export function navigationMenuItems(model: NavigationModel): MenuItem[] {
  return [
    {
      label: 'Show whole genome',
      icon: ZoomOutMapIcon,
      onClick: () => {
        model.showAllRegions()
      },
    },
    {
      label: 'Square view - same bp per pixel',
      icon: CropFreeIcon,
      disabled: !model.canSquareView,
      onClick: () => {
        model.squareView()
      },
    },
  ]
}

interface AutoScaleModel {
  levels: unknown[]
  autoScaleLevelHeights: () => void
}

// auto-scale divides a fixed budget across levels, so one level has no use for it
export function autoScaleMenuItems(model: AutoScaleModel): MenuItem[] {
  return model.levels.length > 1
    ? [
        {
          label: 'Auto-scale level heights',
          onClick: () => {
            model.autoScaleLevelHeights()
          },
        },
      ]
    : []
}

interface CompactViewsModel {
  views: unknown[]
  compactAllViews: () => void
  expandAllViews: () => void
}

// with two rows the per-row item does the same in as many clicks
export function compactViewsMenuItems(model: CompactViewsModel): MenuItem[] {
  return model.views.length > 2
    ? [
        {
          label: 'Compact all views',
          onClick: () => {
            model.compactAllViews()
          },
        },
        {
          label: 'Expand all views',
          onClick: () => {
            model.expandAllViews()
          },
        },
      ]
    : []
}

interface TracksMenuModel {
  views: { assemblyNames: string[] }[]
  levels: (TrackActionView & IAnyStateTreeNode & { tracks: MenuTrack[] })[]
}

/**
 * Each synteny track's own menu. A ribbon band draws no track label to hang
 * one off, so the view menu lists them, under one subheader per pair of rows
 * once there is more than one pair.
 */
export function syntenyTracksMenuItems(model: TracksMenuModel): MenuItem[] {
  const labels = rowLabels(model.views)
  const { levels } = model
  const subMenu = levels.flatMap((level, idx) => {
    const items = level.tracks.map(track => trackSubMenuItem(level, track))
    return levels.length > 1
      ? withSubHeader(`${labels[idx]} → ${labels[idx + 1]}`, items)
      : items
  })
  return subMenu.length > 0
    ? [{ label: 'Tracks', icon: LineStyleIcon, subMenu }]
    : []
}

/**
 * Whether one synteny display could show CIGAR detail — the per-display half of
 * the view's `hasCigarData`. A coarse LOD tier can omit CIGARs the file has, so
 * it answers yes, or the setting would come and go with the zoom.
 */
export function displayCanShowCigar(display: {
  lodTier: LodTier
  featureData?: { hasCigar: boolean }
}) {
  return (
    // a display that hasn't fetched yet
    display.featureData === undefined ||
    // one holding a tier that omits CIGARs it may well have
    display.lodTier === 'coarse' ||
    display.featureData.hasCigar
  )
}
