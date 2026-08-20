import { makeRadioSubMenu, radioItems } from '@jbrowse/core/ui/menuItems'
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import RemoveIcon from '@mui/icons-material/Remove'

import { rowLabels } from '../LinearComparativeView/rowLabel.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { LodTier } from '@jbrowse/synteny-core'

// The sections of the LinearSyntenyView header menu, each gated on the state
// that gives it meaning and returning [] when inapplicable so they spread
// cleanly into the group they belong to. Kept out of the model so the model's
// `.views()` block holds the menu #methods and the two dialogs it opens.
//
// Each takes the narrow structural slice it reads rather than the whole view
// model: the model chain can then pass `self` with no cast, and each section
// documents its own dependencies.

interface RemoveRowModel {
  views: unknown[]
  removeLastRow: () => void
}

// Only terminal removal is supported (see LinearComparativeView.removeLastRow),
// and a 2-row view has nothing to remove without collapsing to a single genome.
export function removeRowMenuItems(model: RemoveRowModel): MenuItem[] {
  return model.views.length > 2
    ? [
        {
          label: 'Remove bottom row',
          icon: RemoveIcon,
          onClick: () => {
            model.removeLastRow()
          },
        },
      ]
    : []
}

interface NavigationModel {
  views: { assemblyNames: string[] }[]
  squareView: () => void
  showAllRegions: () => void
  showAllRegionsSameScale: () => void
  linkViews: boolean
  followSynteny: boolean
  followAnchorIndex: number
  setRowSyncMode: (mode: 'independent' | 'link' | 'follow') => void
  setFollowAnchorIndex: (idx: number) => void
}

const ROW_SYNC_MODES = [
  ['independent', 'Independent'],
  ['link', 'Locked together - rows move together pixel-by-pixel'],
  [
    'follow',
    // "matching", not "syntenic", because at whole-genome zoom a CIGAR-less
    // tier is interpolated across the block rather than walked — close enough
    // to follow by, not a base-level correspondence
    'Follow - auto-aligns views together based on visible features',
  ],
] as const

/**
 * The three zoom commands that act on every row at once, and the coupling that
 * decides whether a pan of one row is a pan of the others.
 *
 * `squareView` AVERAGES the rows' scales where the dotplot's EQUALIZES them, so
 * both keep a dash clause — a bare "Square view" in the two places would name
 * two different operations.
 *
 * The sync modes are MUTUALLY EXCLUSIVE in substance, not just presentation: a
 * pixel lock and a synteny follow disagree about where a row belongs the moment
 * an indel separates them, and with both on the row is placed twice per pan.
 * Hence a radio group and one setter. Their dash clauses are the whole
 * distinction — *by pixels* vs *by the alignment* — which two bare names next to
 * each other do not carry.
 *
 * The anchor picker is offered even for a two-row view: which haplotype drives
 * and which follows is exactly the choice someone comparing two of them wants,
 * and nothing about the pan reveals it.
 */
export function navigationMenuItems(model: NavigationModel): MenuItem[] {
  const { linkViews, followSynteny, followAnchorIndex } = model
  return [
    {
      label: 'Square view - average bp per pixel',
      icon: CropFreeIcon,
      onClick: () => {
        model.squareView()
      },
    },
    {
      // no icon on either: the same one on both would say nothing about which
      // to pick, and the dash clause is all that separates them
      label: 'Show all regions - each row fit to width',
      onClick: () => {
        model.showAllRegions()
      },
    },
    {
      label: 'Show all regions - same bp per pixel',
      onClick: () => {
        model.showAllRegionsSameScale()
      },
    },
    makeRadioSubMenu({
      label: 'Link views',
      icon: LinkIcon,
      value: followSynteny ? 'follow' : linkViews ? 'link' : 'independent',
      options: ROW_SYNC_MODES,
      onChange: mode => {
        model.setRowSyncMode(mode)
      },
      extraItems: followSynteny
        ? [
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
          ]
        : [],
    }),
  ]
}

interface AutoScaleModel {
  levels: unknown[]
  autoScaleLevelHeights: () => void
}

// Pointless with one level — auto-scale divides a fixed budget across levels.
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

interface RowMenusModel {
  views: { assemblyNames: string[]; menuItems: () => MenuItem[] }[]
  compactAllViews: () => void
  expandAllViews: () => void
}

// Collapse or expand every genome row at once, worth offering only once there
// are more rows than the two a plain pairwise view has — with two, the per-row
// item next to it does the same thing in the same number of clicks.
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
 * The per-row LGV menus, reachable from the synteny view's own menu: each row's
 * hamburger is otherwise only available from that row's header, which a compact
 * row doesn't show.
 *
 * ONE ROW PER GENOME, which is why the old per-row compact checkboxes are gone:
 * `isViewCompact` IS the row's `scalebarOnly`, so the checkbox and that row's
 * own "Collapse to ruler" were two spellings of one toggle listed in two
 * submenus, under labels that shared nothing.
 */
export function rowMenuItems(model: RowMenusModel): MenuItem[] {
  return rowLabels(model.views).map((label, idx) => ({
    label,
    subMenu: model.views[idx]!.menuItems(),
  }))
}

// The same per-row menus for the app's view menu, where there is no surrounding
// "Rows" group to sit in and so the name has to carry the whole idea.
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
 * the view's `hasCigarData`. Three ways to answer "maybe", and the coarse one is
 * the subtle one: a display serving the coarse LOD tier reports `hasCigar` false
 * because that tier omits the CIGARs, NOT because the file lacks them. Reading
 * that as "no CIGAR data" retracted the whole CIGAR control on zoom-out and put
 * it back on zoom-in — the tier switch, an implementation detail, made a
 * setting appear and disappear under the user.
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
