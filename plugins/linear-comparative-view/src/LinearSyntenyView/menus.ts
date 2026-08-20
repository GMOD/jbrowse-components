import { radioItems } from '@jbrowse/core/ui/menuItems'
import LinkIcon from '@mui/icons-material/Link'
import RemoveIcon from '@mui/icons-material/Remove'

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
    label: 'Link scroll and zoom',
    subLabel: 'Rows move together by pixels',
  },
  {
    // "matching", not "syntenic", because at whole-genome zoom a CIGAR-less
    // tier is interpolated across the block rather than walked — close enough
    // to follow by, not a base-level correspondence
    value: 'follow',
    label: 'Follow the matching region',
    subLabel: 'Rows move to what aligns to the anchor',
  },
] as const

/**
 * How the genome rows track each other — three MUTUALLY EXCLUSIVE modes, so a
 * radio group rather than the two independent checkboxes this would otherwise
 * be. They are exclusive in substance, not just in presentation: a pixel lock
 * and a synteny follow disagree about where a row belongs the moment an indel
 * separates them, and with both on the row is placed twice per pan. The two
 * subLabels are what tell them apart — the whole difference is *by pixels* vs
 * *by the alignment*, and neither label says that on its own.
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
      label: 'Row sync',
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

// Gated on data, not config: coarse-tier PIF and CIGAR-less PAF have no ops to
// display, so the whole section would be inert.
interface OffscreenMateModel {
  showOffscreenMates: boolean
  offscreenMateTally: { refName: string; count: number }[]
  setShowOffscreenMates: (arg: boolean) => void
}

// Locale-grouped, because these run to five figures on a whole chromosome and
// "2767" reads as a coordinate in a menu full of them.
function formatCount(n: number) {
  return n.toLocaleString()
}

/**
 * The item's label IS the finding. A checkbox reading "Show unpaired
 * alignments" tells a reader nothing they can act on, where "2,767 alignments
 * map to 9 contigs not shown" is the whole point of the feature — a locus that
 * looks syntenic to nothing here is syntenic to something the view is not
 * displaying, and the contig names underneath are the rows worth adding.
 *
 * GATED ON THERE BEING SOME, so a two-contig comparison with nothing hidden
 * carries no menu item claiming there might be. That also means the item
 * appears only once a fetch has landed, which is right: before then the honest
 * answer is not zero, it is unknown.
 */
export function offscreenMateMenuItems(model: OffscreenMateModel): MenuItem[] {
  const { offscreenMateTally: tally } = model
  if (tally.length === 0) {
    return []
  }
  const total = tally.reduce((sum, e) => sum + e.count, 0)
  const contigs = tally.length === 1 ? '1 contig' : `${tally.length} contigs`
  const alignments =
    total === 1 ? '1 alignment maps' : `${formatCount(total)} alignments map`
  return [
    {
      label: `${alignments} to ${contigs} not shown`,
      type: 'checkbox' as const,
      checked: model.showOffscreenMates,
      onClick: () => {
        model.setShowOffscreenMates(!model.showOffscreenMates)
      },
    },
  ]
}

export function cigarModeMenuItems(model: CigarModeModel): MenuItem[] {
  return model.hasCigarData
    ? [
        {
          label: 'CIGAR display mode',
          subMenu: CIGAR_MODE_OPTIONS.map(({ label, value: mode }) => ({
            label,
            type: 'radio' as const,
            checked: model.cigarMode === mode,
            onClick: () => {
              model.setCigarMode(mode)
            },
          })),
        },
      ]
    : []
}
