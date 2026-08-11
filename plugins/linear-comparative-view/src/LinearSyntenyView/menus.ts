import RemoveIcon from '@mui/icons-material/Remove'

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
            ...model.views.map((view, idx) => ({
              label: view.assemblyNames[0] ?? `View ${idx + 1}`,
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
      subMenu: model.views.map((view, idx) => ({
        label: view.assemblyNames[0] ?? `View ${idx + 1}`,
        subMenu: view.menuItems(),
      })),
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

const CIGAR_MODES: { label: string; mode: CigarMode }[] = [
  { label: 'Colored indels', mode: 'full' },
  { label: 'Transparent indels', mode: 'matches' },
  { label: 'None', mode: 'off' },
]

// Gated on data, not config: coarse-tier PIF and CIGAR-less PAF have no ops to
// display, so the whole section would be inert.
export function cigarModeMenuItems(model: CigarModeModel): MenuItem[] {
  return model.hasCigarData
    ? [
        {
          label: 'CIGAR display mode',
          subMenu: CIGAR_MODES.map(({ label, mode }) => ({
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
