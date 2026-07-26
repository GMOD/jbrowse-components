import { lazy } from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import { launchBreakpointSplitView } from '@jbrowse/sv-core'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import {
  buildPairedEndMateFeature,
  getMateFields,
} from '../../shared/mateFeature.ts'
import { isInterbaseType } from '../../shared/types.ts'
import { CIGAR_TYPE_LABELS } from '../components/alignmentComponentUtils.ts'
import {
  openCigarWidget,
  openIndicatorWidget,
  openModificationWidget,
} from '../components/detailWidgets.ts'
import { viewMateRegionInCurrentView } from '../viewMateRegion.ts'

import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type {
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'
import type { FilterBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const SortByTagDialog = lazy(() => import('../dialogs/SortByTagDialog.tsx'))

type LGV = LinearGenomeViewModel

interface ContextMenuModel extends IAnyStateTreeNode {
  // The read under the cursor, known only after a GetPileupFeatureDetails round
  // trip — so it is undefined for the first paint of every menu. Items that can
  // be built from the id alone must not gate on it (see withContextMenuFeature).
  contextMenuFeature: Feature | undefined
  // The same read's id, carried by the hit test and so known synchronously.
  contextMenuFeatureId: string | undefined
  contextMenuCigarHit: CigarHitResult | undefined
  contextMenuIndicatorHit: IndicatorHitResult | undefined
  contextMenuModHit: ModificationHitResult | undefined
  // The block under the right-click (refName + worker result + bp range), the
  // single source of the position sort's refName and the indicator widget's
  // rpcData. Captured once when the menu is built so its onClicks operate on a
  // snapshot — closeContextMenu runs before the click callback, so reading it
  // live would see undefined.
  contextMenuBlock: ResolvedBlock | undefined
  // Genomic column under the right-click, anchoring the read menu's "sort at the
  // clicked position" items. Captured into the onClicks like contextMenuBlock.
  contextMenuGenomicPos: number | undefined
  filterBy: FilterBy
  setFilterBy: (filterBy: FilterBy) => void
  setSortedByAtPosition: (arg: {
    type: string
    pos: number
    refName: string
    tag?: string
  }) => void
  selectFeature: (feature: Feature) => void
  withFeatureById: (
    featureId: string,
    onFeat: (feat: Feature) => void,
  ) => Promise<void>
}

// Act on the read the menu was opened over. `feat` is the fetched feature as
// captured when this menu was built: the fetch landing re-runs the menu builder,
// so by the time anything is clicked it is normally in hand and this is
// synchronous. The id path covers the narrow case of a click that beats the RPC.
// Neither can be read live inside the onClick — closeContextMenu clears both
// before the callback fires.
export function withContextMenuFeature(
  self: ContextMenuModel,
  featureId: string,
  feat: Feature | undefined,
  onFeat: (feat: Feature) => void,
) {
  if (feat) {
    onFeat(feat)
  } else {
    void self.withFeatureById(featureId, onFeat)
  }
}

// SAM tags live under a `tags` object on the fetched feature, but a few
// well-known ones (e.g. SA) are also surfaced as top-level fields.
function getReadTag(feat: Feature, tag: string): string | undefined {
  const tags = feat.get('tags') as Record<string, unknown> | undefined
  const val = tags?.[tag] ?? feat.get(tag)
  return val === undefined ? undefined : String(val)
}

// Set the filter for one tag while preserving filters on other tags, so quick
// HP/RG filters (and any dialog-set tag) coexist instead of clobbering.
function setTagFilter(self: ContextMenuModel, tag: string, value: string) {
  const others = (self.filterBy.tagFilters ?? []).filter(f => f.tag !== tag)
  self.setFilterBy({
    ...self.filterBy,
    tagFilters: [...others, { tag, value }],
  })
}

// Copy plain text (read name, sequence, feature JSON) with a success/error
// snackbar. The clipboard util is dynamically imported so it stays out of the
// initial bundle. Runs only on menu click, off the already-fetched feature — no
// RPC.
async function copyText(self: ContextMenuModel, text: string, what: string) {
  const session = getSession(self)
  try {
    const { default: copy } = await import('@jbrowse/core/util/copyToClipboard')
    copy(text)
    session.notify(`Copied ${what} to clipboard`, 'success')
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}

// The whole feature as JSON, minus the synthetic uniqueId — the "all fields"
// copy, shared with the displays that offer it as a top-level item rather than
// inside a Copy submenu (LGVSyntenyDisplay, whose PAF block has no read name or
// sequence to copy beside it).
export function copyFeatureInfo(self: ContextMenuModel, feat: Feature) {
  const { uniqueId: _uniqueId, ...rest } = feat.toJSON()
  void copyText(self, JSON.stringify(rest, null, 4), 'feature info')
}

// Cigar and coverage-indicator hits build the identical two-item submenu: sort
// the pileup by what's under the cursor, or open its details widget. `block` is
// captured once by getContextMenuItems and read inside the onClicks because
// closeContextMenu nulls self.contextMenuBlock before they fire.
//
// `sort` false collapses the pair to the bare details item — for a display whose
// sort menu doesn't offer the position-anchored modes (LGVSyntenyDisplay), where
// the submenu's sort peer would set an ordering its own "Sort by..." radio group
// can't show as checked.
function sortAndDetailsSubMenu({
  self,
  block,
  label,
  sortLabel,
  sortType,
  position,
  detailsLabel,
  openDetails,
  sort,
}: {
  self: ContextMenuModel
  block: ResolvedBlock | undefined
  label: string
  sortLabel: string
  sortType: string
  position: number
  detailsLabel: string
  openDetails: (block: ResolvedBlock) => void
  sort: boolean
}): MenuItem {
  const detailsItem = {
    label: detailsLabel,
    icon: MenuOpenIcon,
    onClick: () => {
      if (block) {
        openDetails(block)
      }
    },
  }
  return sort
    ? {
        label,
        type: 'subMenu',
        subMenu: [
          {
            label: sortLabel,
            icon: SwapVertIcon,
            onClick: () => {
              if (block) {
                self.setSortedByAtPosition({
                  type: sortType,
                  pos: position,
                  refName: block.refName,
                })
              }
            },
          },
          detailsItem,
        ],
      }
    : detailsItem
}

// Quick per-read filters (read name / HP / RG) plus a clear item, shown only
// when a filter is active. Each coexists with the others (setTagFilter merges).
function getFilterSubMenu(self: ContextMenuModel, feat: Feature): MenuItem[] {
  const readName = feat.get('name')
  const hp = getReadTag(feat, 'HP')
  const rg = getReadTag(feat, 'RG')
  const sub: MenuItem[] = []
  if (readName) {
    sub.push({
      label: 'Filter for this read',
      icon: FilterAltIcon,
      onClick: () => {
        self.setFilterBy({ ...self.filterBy, readName })
      },
    })
  }
  if (hp !== undefined) {
    sub.push({
      label: `Filter for this haplotype (HP:${hp})`,
      icon: FilterAltIcon,
      onClick: () => {
        setTagFilter(self, 'HP', hp)
      },
    })
  }
  if (rg !== undefined) {
    sub.push({
      label: `Filter for this read group (RG:${rg})`,
      icon: FilterAltIcon,
      onClick: () => {
        setTagFilter(self, 'RG', rg)
      },
    })
  }
  const hasReadOrTagFilter =
    self.filterBy.readName !== undefined ||
    (self.filterBy.tagFilters?.length ?? 0) > 0
  if (hasReadOrTagFilter) {
    sub.push({
      label: 'Clear read/tag filters',
      icon: FilterAltOffIcon,
      onClick: () => {
        self.setFilterBy({
          flagInclude: self.filterBy.flagInclude,
          flagExclude: self.filterBy.flagExclude,
        })
      },
    })
  }
  return sub
}

// Copy read name / 1-based location / raw sequence / full feature JSON, each
// present only when the underlying field exists (feature info always is).
function getCopySubMenu(self: ContextMenuModel, feat: Feature): MenuItem[] {
  const readName = feat.get('name')
  const refName = feat.get('refName')
  const seq = feat.get('seq')
  const sub: MenuItem[] = []
  if (readName) {
    sub.push({
      label: 'Copy read name',
      onClick: () => {
        void copyText(self, String(readName), 'read name')
      },
    })
  }
  if (refName) {
    const locString = `${refName}:${feat.get('start') + 1}-${feat.get('end')}`
    sub.push({
      label: 'Copy location',
      subLabel: 'e.g. to paste into the location search box',
      onClick: () => {
        void copyText(self, locString, 'location')
      },
    })
  }
  if (seq) {
    sub.push({
      label: 'Copy read sequence',
      subLabel: 'raw read bases, e.g. to paste into BLAT/BLAST',
      onClick: () => {
        void copyText(self, String(seq), 'read sequence')
      },
    })
  }
  sub.push({
    label: 'Copy feature info',
    subLabel: 'all fields as JSON',
    onClick: () => {
      copyFeatureInfo(self, feat)
    },
  })
  return sub
}

// Items for what sits under the cursor — the CIGAR op, the modified base, the
// coverage interbase indicator — as opposed to the read the cursor is over.
// Nothing here reads a read/pair field, so LGVSyntenyDisplay (which draws the
// same mismatch and interbase layers off a PAF cs/CIGAR) reuses them, with
// `sort: false` since its sort menu offers no position-anchored mode.
export function getHitMenuItems(
  self: ContextMenuModel,
  { sort = true }: { sort?: boolean } = {},
): MenuItem[] {
  const cigarHit = self.contextMenuCigarHit
  const indicatorHit = self.contextMenuIndicatorHit
  const modHit = self.contextMenuModHit
  const block = self.contextMenuBlock
  const items: MenuItem[] = []

  if (cigarHit) {
    const typeLabel = CIGAR_TYPE_LABELS[cigarHit.type] ?? cigarHit.type
    const isInterbase = isInterbaseType(cigarHit.type)
    items.push(
      sortAndDetailsSubMenu({
        self,
        block,
        label: typeLabel,
        sortLabel: isInterbase
          ? `Sort by ${typeLabel.toLowerCase()} at position`
          : 'Sort by base at position',
        sortType: isInterbase ? cigarHit.type : 'basePair',
        position: cigarHit.position,
        // Named with its span, so "Open deletion details" beside a feature-level
        // "Open feature details" reads as the CIGAR op the cursor is on rather
        // than as an unexplained second kind of detail. A mismatch is 1bp by
        // construction and says nothing.
        detailsLabel: `Open ${typeLabel.toLowerCase()} details${
          cigarHit.length > 1 ? ` (${cigarHit.length.toLocaleString()} bp)` : ''
        }`,
        openDetails: b => {
          openCigarWidget(self, cigarHit, b.refName)
        },
        sort,
      }),
    )
  }

  // A modified base opens its per-read modification widget from the menu too —
  // reachable on a plain modified base, where there's no cigarHit submenu above.
  // block/modHit are snapshotted (like cigarHit/block) since closeContextMenu
  // clears them before this onClick fires. snpBase annotates the widget when the
  // modified base is also a SNP, mirroring the left-click path.
  if (modHit && block) {
    const snpBase = cigarHit?.type === 'mismatch' ? cigarHit.base : undefined
    items.push({
      label: 'Open modification details',
      icon: MenuOpenIcon,
      onClick: () => {
        openModificationWidget(self, modHit, block.refName, snpBase)
      },
    })
  }

  if (indicatorHit) {
    const typeLabel =
      CIGAR_TYPE_LABELS[indicatorHit.indicatorType] ??
      indicatorHit.indicatorType
    items.push(
      sortAndDetailsSubMenu({
        self,
        block,
        label: `Coverage ${typeLabel}`,
        sortLabel: `Sort by ${typeLabel.toLowerCase()} at position`,
        sortType: indicatorHit.indicatorType,
        position: indicatorHit.position,
        detailsLabel: `Open ${typeLabel.toLowerCase()} details`,
        openDetails: b => {
          openIndicatorWidget(self, indicatorHit, b.refName, b.rpcData)
        },
        sort,
      }),
    )
  }

  return items
}

// Right-click menu over the pileup: the hit items above, plus mate-view,
// filter, copy and feature-detail actions for the read itself. Split out of the
// model to mirror trackMenuItems (menus/index.ts).
export function getContextMenuItems(self: ContextMenuModel): MenuItem[] {
  const feat = self.contextMenuFeature
  const featureId = self.contextMenuFeatureId
  const block = self.contextMenuBlock
  const items = getHitMenuItems(self)

  // Split on what each item actually needs. The id says "the cursor is over a
  // read" the moment the menu opens; the feature says which read, an RPC later.
  // Everything answerable from the id is offered at first paint — the menu used
  // to open bare and grow these a fetch later, which on a slow lookup meant
  // right-clicking a read produced a menu with nothing in it.
  if (featureId !== undefined) {
    items.push({
      label: 'Open feature details',
      icon: MenuOpenIcon,
      onClick: () => {
        withContextMenuFeature(self, featureId, feat, f => {
          self.selectFeature(f)
        })
      },
    })
    // Sort the pileup at the clicked column — the same criteria as the track
    // menu's center-line sorts, but anchored where the user right-clicked
    // (`pos`/`refName` snapshotted like `block`, since closeContextMenu clears
    // them before the onClick fires). Only the position-anchored criteria
    // appear here; "start location" / "longest reads first" are whole-pileup
    // orderings with no clicked position to anchor on.
    if (block && self.contextMenuGenomicPos !== undefined) {
      const pos = self.contextMenuGenomicPos
      const { refName } = block
      items.push({
        label: 'Sort by',
        icon: SwapVertIcon,
        type: 'subMenu',
        subMenu: [
          {
            label: 'Read strand',
            onClick: () => {
              self.setSortedByAtPosition({ type: 'strand', pos, refName })
            },
          },
          {
            label: 'Base pair',
            onClick: () => {
              self.setSortedByAtPosition({ type: 'basePair', pos, refName })
            },
          },
          {
            label: 'Tag...',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                SortByTagDialog,
                {
                  handleClose,
                  onSubmit: (tag: string) => {
                    self.setSortedByAtPosition({
                      type: 'tag',
                      pos,
                      refName,
                      tag,
                    })
                  },
                },
              ])
            },
          },
        ],
      })
    }
  }

  // The rest read the read's own fields — mate coordinates, tags, name,
  // sequence — so they genuinely have to wait for the fetch. They append below
  // the id-built items above, so landing late grows the menu at the bottom
  // rather than shifting what is already under the cursor.
  if (feat) {
    const mateFields = getMateFields(feat)
    if (mateFields) {
      items.push({
        label: 'View mate',
        icon: CompareArrowsIcon,
        type: 'subMenu',
        subMenu: [
          {
            label: 'Split current view to show mate',
            onClick: () => {
              viewMateRegionInCurrentView({
                view: getContainingView(self) as LGV,
                feature: feat,
              })
            },
          },
          {
            label: 'Open breakpoint split view',
            onClick: () => {
              const view = getContainingView(self) as LGV
              const assemblyName = view.assemblyNames[0]
              if (assemblyName) {
                launchBreakpointSplitView({
                  session: getSession(self),
                  view,
                  assemblyName,
                  feature: buildPairedEndMateFeature(mateFields),
                })
              }
            },
          },
        ],
      })
    }
    const filterSubMenu = getFilterSubMenu(self, feat)
    if (filterSubMenu.length) {
      items.push({
        label: 'Filter',
        icon: FilterAltIcon,
        type: 'subMenu',
        subMenu: filterSubMenu,
      })
    }
    items.push({
      label: 'Copy',
      icon: ContentCopyIcon,
      type: 'subMenu',
      subMenu: getCopySubMenu(self, feat),
    })
  }

  return items
}
