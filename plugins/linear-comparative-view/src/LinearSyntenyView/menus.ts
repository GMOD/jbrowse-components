import { radioItems } from '@jbrowse/core/ui/menuItems'
import AnchorIcon from '@mui/icons-material/Anchor'
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import RemoveIcon from '@mui/icons-material/Remove'

import { rowLabels } from './rowLabel.ts'

import type { FollowHost } from '../SyntenyFollow/followHost.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { LodTier } from '@jbrowse/synteny-core'

// The sections of the LinearSyntenyView header menu. Each returns [] when it
// does not apply, and takes the structural slice it reads rather than the whole
// view model, so the model chain passes `self` with no cast.

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

interface NavigationModel extends FollowHost {
  views: { assemblyNames: string[] }[]
  squareView: () => void
  showAllRegionsAcrossRows: (sameScale: boolean) => void
  sameScale: boolean
  followMatchOrientation: boolean
  setFollowSynteny: (flag: boolean) => void
  setFollowMatchOrientation: (arg: boolean) => void
}

// `keepMenuOpen: false`: the click re-frames every row, and a radio would
// otherwise hold the menu open over the result
const SHOW_ALL_REGIONS_MODES = [
  {
    value: 'fit',
    label: 'Show all regions - each row fit to width',
    keepMenuOpen: false,
  },
  {
    value: 'same',
    label: 'Show all regions - same bp per pixel',
    keepMenuOpen: false,
  },
] as const

/**
 * The three zoom commands that act on every row at once, and the follow.
 *
 * The two show-all-regions rows act on a click and carry a mark: the mark names
 * the fit rule the rows are under (`sameScale`), which holds after a zoom back
 * in.
 */
export function navigationMenuItems(model: NavigationModel): MenuItem[] {
  const {
    sameScale,
    followSynteny,
    followAnchorIndex,
    followMatchOrientation,
  } = model
  return [
    {
      label: 'Square view - average bp per pixel',
      icon: CropFreeIcon,
      onClick: () => {
        model.squareView()
      },
    },
    ...radioItems(SHOW_ALL_REGIONS_MODES, sameScale ? 'same' : 'fit', m => {
      model.showAllRegionsAcrossRows(m === 'same')
    }),
    {
      label: 'Follow',
      icon: LinkIcon,
      subMenu: [
        {
          type: 'checkbox',
          label: 'Other rows track the anchor row through the alignment',
          checked: followSynteny,
          onClick: () => {
            model.setFollowSynteny(!followSynteny)
          },
        },
        ...(followSynteny
          ? ([
              { type: 'subHeader', label: 'Anchor row' },
              ...radioItems(
                rowLabels(model.views).map((label, idx) => ({
                  value: `${idx}`,
                  label,
                })),
                `${followAnchorIndex}`,
                idx => {
                  model.setFollowAnchorIndex(Number(idx))
                },
              ),
              { type: 'subHeader', label: 'Orientation' },
              {
                type: 'checkbox',
                label:
                  'Flip rows to match the anchor - inside inverted alignments',
                checked: followMatchOrientation,
                onClick: () => {
                  model.setFollowMatchOrientation(!followMatchOrientation)
                },
              },
            ] satisfies MenuItem[])
          : []),
      ],
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

interface RowMenusModel extends FollowHost {
  views: { assemblyNames: string[]; menuItems: () => MenuItem[] }[]
  compactAllViews: () => void
  expandAllViews: () => void
}

// with two rows the per-row item does the same in as many clicks
export function compactViewsMenuItems(model: RowMenusModel): MenuItem[] {
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

/**
 * The per-row LGV menus: each row's own menu is otherwise only in that row's
 * header, which a compact row doesn't show. While following, each leads with
 * taking the anchor, and the anchor row wears the mark.
 */
export function rowMenuItems(model: RowMenusModel): MenuItem[] {
  const { followSynteny, followAnchorIndex } = model
  return rowLabels(model.views).map((label, idx) => ({
    label,
    icon: followSynteny && idx === followAnchorIndex ? AnchorIcon : undefined,
    subMenu: [
      ...(followSynteny
        ? ([
            {
              type: 'radio',
              label: 'Anchor the follow on this row',
              checked: idx === followAnchorIndex,
              onClick: () => {
                model.setFollowAnchorIndex(idx)
              },
            },
          ] satisfies MenuItem[])
        : []),
      ...model.views[idx]!.menuItems(),
    ],
  }))
}

// the same per-row menus for the app's view menu, which has no "Rows" group
export function rowViewMenuItems(model: RowMenusModel): MenuItem[] {
  return [
    {
      label: 'Row view menus',
      subMenu: rowMenuItems(model),
    },
  ]
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
