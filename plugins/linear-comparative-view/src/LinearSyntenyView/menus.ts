import { radioItems } from '@jbrowse/core/ui/menuItems'
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import RemoveIcon from '@mui/icons-material/Remove'
import WarningIcon from '@mui/icons-material/WarningAmber'
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap'

import { rowLabels } from '../LinearComparativeView/rowLabel.ts'
import { CIGAR_MODE_OPTIONS } from './cigarModes.ts'

import type { CigarMode } from './types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { LodTier } from '@jbrowse/synteny-core'

// The conditional sections of the LinearSyntenyView header menu, each gated on
// the state that gives it meaning and returning [] when inapplicable so they
// spread cleanly into the flat list. Kept out of the model so the model's
// `.views()` block holds only the three menu #methods themselves.
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

interface ScaleRowsModel {
  squareView: () => void
  showAllRegions: () => void
  showAllRegionsSameScale: () => void
}

/**
 * The commands that set zoom across every row at once, together because they
 * are only meaningful against each other: each one answers "what do the rows
 * agree on" differently, and any of them read alone looks like the only way to
 * zoom out.
 *
 * THE TWO ZOOM-OUTS NEST UNDER ONE "Show all regions", so the shared half of
 * the name is said once and the submenu holds only what differs. Flat, both
 * rows opened with the same four words and the reader had to get to the dash
 * before either row said anything.
 *
 * LABELLED IN THE DOTPLOT'S STYLE — the quantity held equal — because that
 * vocabulary already ships ("Square view - same bp per pixel"). Square view
 * keeps its dash clause even alone at the top level: THIS view's squareView
 * AVERAGES the rows' scales where the dotplot's EQUALIZES them, so a bare
 * "Square view" in both places names two different operations.
 *
 * NOT under "Show...", despite the name: that submenu is visibility toggles and
 * these are navigation gestures. Same call, and the same reasoning, as the
 * LGV's scroll-zoom item.
 */
export function scaleRowsMenuItems(model: ScaleRowsModel): MenuItem[] {
  return [
    {
      label: 'Square view - average bp per pixel',
      icon: CropFreeIcon,
      onClick: () => {
        model.squareView()
      },
    },
    {
      label: 'Show all regions',
      icon: ZoomOutMapIcon,
      subMenu: [
        {
          label: 'Each row fit to width',
          onClick: () => {
            model.showAllRegions()
          },
        },
        {
          label: 'Same bp per pixel',
          onClick: () => {
            model.showAllRegionsSameScale()
          },
        },
      ],
    },
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

interface GenomeViewsModel {
  views: { assemblyNames: string[] }[]
  compactAllViews: () => void
  expandAllViews: () => void
  isViewCompact: (idx: number) => boolean
  toggleCompactView: (idx: number) => void
}

// Per-row compact toggles, worth a submenu only once there are more rows than
// the two a plain pairwise view has.
export function genomeViewsMenuItems(model: GenomeViewsModel): MenuItem[] {
  return model.views.length > 2
    ? [
        {
          label: 'Genome views',
          subMenu: [
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
            ...rowLabels(model.views).map((label, idx) => ({
              label,
              type: 'checkbox' as const,
              checked: !model.isViewCompact(idx),
              onClick: () => {
                model.toggleCompactView(idx)
              },
            })),
          ],
        },
      ]
    : []
}

interface RowViewMenusModel {
  views: { assemblyNames: string[]; menuItems: () => MenuItem[] }[]
}

// The per-row LGV menus, reachable from the synteny view's own menu: each row's
// hamburger is otherwise only available from that row's header, which a compact
// row doesn't show.
export function rowViewMenuItems(model: RowViewMenusModel): MenuItem[] {
  return [
    {
      label: 'Row view menus',
      subMenu: rowLabels(model.views).map((label, idx) => ({
        label,
        subMenu: model.views[idx]!.menuItems(),
      })),
    },
  ]
}

interface RowSyncModel {
  views: { assemblyNames: string[] }[]
  linkViews: boolean
  followSynteny: boolean
  followAnchorIndex: number
  setRowSyncMode: (mode: 'independent' | 'link' | 'follow') => void
  setFollowAnchorIndex: (idx: number) => void
}

const ROW_SYNC_MODES = [
  { value: 'independent', label: 'Independent' },
  {
    value: 'link',
    label: 'Locked together - rows move together pixel-by-pixel',
  },
  {
    // "matching", not "syntenic", because at whole-genome zoom a CIGAR-less
    // tier is interpolated across the block rather than walked — close enough
    // to follow by, not a base-level correspondence
    value: 'follow',
    label: 'Follow - auto-aligns views together based on visible features',
  },
] as const

/**
 * How the genome rows track each other — three MUTUALLY EXCLUSIVE modes, so a
 * radio group rather than the two independent checkboxes this would otherwise
 * be. They are exclusive in substance, not just in presentation: a pixel lock
 * and a synteny follow disagree about where a row belongs the moment an indel
 * separates them, and with both on the row is placed twice per pan. The two
 * couplings are told apart by their dash clauses and nothing else — the whole
 * difference is *by pixels* vs *by the alignment*, which two bare
 * names next to each other do not carry.
 *
 * ONE SUBMENU, ANCHOR ROWS INLINE UNDER A SUBHEADER, rather than a nested
 * "Anchor row" submenu: which row drives is half of what there is to set here,
 * and a second level put it three deep from the hamburger for no gain — the
 * rows are radio rows in the same group style as the modes above them, and
 * only appear when there is a follow for them to anchor.
 *
 * The anchor picker is offered even for the ordinary two-row view: which
 * haplotype drives and which follows is exactly the choice someone comparing
 * two of them wants, and nothing about the pan reveals it.
 */
export function rowSyncMenuItems(model: RowSyncModel): MenuItem[] {
  const { linkViews, followSynteny, followAnchorIndex } = model
  const mode = followSynteny ? 'follow' : linkViews ? 'link' : 'independent'
  return [
    {
      label: 'Link views',
      icon: LinkIcon,
      subMenu: [
        ...radioItems(ROW_SYNC_MODES, mode, m => {
          model.setRowSyncMode(m)
        }),
        ...(followSynteny
          ? [
              { type: 'subHeader' as const, label: 'Anchor row' },
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
          : []),
      ],
    },
  ]
}

interface CigarModeModel {
  hasCigarData: boolean
  cigarMode: CigarMode
  setCigarMode: (arg: CigarMode) => void
}

/**
 * Whether one synteny display could show CIGAR detail — the per-display half of
 * the view's `hasCigarData`. Three ways to answer "maybe", and the coarse one is
 * the subtle one: a display serving the coarse LOD tier reports `hasCigar` false
 * because that tier omits the CIGARs, NOT because the file lacks them. Reading
 * that as "no CIGAR data" retracted the whole CIGAR menu on zoom-out and put it
 * back on zoom-in — the tier switch, an implementation detail, made a menu
 * appear and disappear under the user.
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

export type OffscreenMateMode = 'off' | 'query' | 'both'

interface OffscreenMateModel {
  offscreenMateMode: OffscreenMateMode
  offscreenMateTally: { refName: string; count: number }[]
  setOffscreenMateMode: (mode: OffscreenMateMode) => void
}

// Locale-grouped, because these run to five figures on a whole chromosome and
// "2767" reads as a coordinate in a menu full of them.
function formatCount(n: number) {
  return n.toLocaleString()
}

/**
 * HOW HARD TO LOOK, as three steps of one question rather than two checkboxes
 * of two. A reader is not choosing between "mark them" and "search both rows";
 * they are deciding how much of what this view cannot draw they want to know
 * about, and the second step costs a query where the first is free.
 *
 * ONE CONTROL, TWO PROPERTIES, which is what `rowSyncMenuItems` above does with
 * `linkViews`/`followSynteny` and for the same reason. They stay separate
 * properties because they are separate KINDS: `showOffscreenMates` is a
 * repaint — the worker counted and placed those marks whichever way it sits —
 * and `bidirectionalFetch` is a fetch input. Fusing them into one boolean would
 * put the free half behind a network round trip, which is the mistake
 * `drawLocationMarkers` was in the fetch key for.
 *
 * It also closes the state the pair could reach and nothing wanted: fetching
 * the second row and then not drawing what it found.
 */
const OFFSCREEN_MATE_MODES = [
  { value: 'off', label: 'Off' },
  {
    value: 'query',
    label: 'Mark them',
    subLabel: 'From the alignments this view already has',
  },
  {
    value: 'both',
    label: 'Mark them, searching both rows',
    subLabel:
      'A second query per row pair, and the only way to find the ones anchored below',
  },
] as const

/**
 * The group's label IS the finding. "Show unpaired alignments" tells a reader
 * nothing they can act on, where "2,767 alignments map to 9 contigs not shown"
 * is the whole point of the feature — a locus that looks syntenic to nothing
 * here is syntenic to something the view is not displaying.
 *
 * NOT GATED ON THERE BEING SOME, unlike the checkbox this replaced. A count of
 * zero is not the same as nothing to offer: `both` is the mode that would go
 * and find out, and gating the control on the number it exists to change is a
 * door that only opens once you are already through it. With no fetch landed
 * yet the honest label is neither a number nor a zero, so it names the subject
 * instead.
 */
export function offscreenMateMenuItems(model: OffscreenMateModel): MenuItem[] {
  const { offscreenMateTally: tally } = model
  const total = tally.reduce((sum, e) => sum + e.count, 0)
  const contigs = tally.length === 1 ? '1 contig' : `${tally.length} contigs`
  const alignments =
    total === 1 ? '1 alignment maps' : `${formatCount(total)} alignments map`
  return [
    {
      label:
        tally.length > 0
          ? `${alignments} to ${contigs} not shown`
          : 'Alignments this view cannot draw',
      subMenu: radioItems(
        OFFSCREEN_MATE_MODES,
        model.offscreenMateMode,
        mode => {
          model.setOffscreenMateMode(mode)
        },
      ),
    },
  ]
}

export function cigarModeMenuItems(model: CigarModeModel): MenuItem[] {
  return model.hasCigarData
    ? [
        {
          label: 'CIGAR display mode',
          // Built here rather than with `radioItems` because one row differs:
          // 'off' is the mode that can mislead, and the icon says so on the row
          // instead of only in its tooltip.
          subMenu: CIGAR_MODE_OPTIONS.map(({ value, label, ...rest }) => ({
            label,
            ...rest,
            icon: value === 'off' ? WarningIcon : undefined,
            type: 'radio' as const,
            checked: model.cigarMode === value,
            onClick: () => {
              model.setCigarMode(value)
            },
          })),
        },
      ]
    : []
}
