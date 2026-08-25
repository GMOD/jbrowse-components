import { lazy } from 'react'

import {
  assembleLocString,
  getContainingView,
  getDialogHost,
  getSession,
} from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import {
  hasBreakpointSplitView,
  launchBreakpointSplitView,
} from '@jbrowse/sv-core'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import { snpBaseFromCigar } from '../../shared/hitTestTypes.ts'
import {
  buildPairedEndMateFeature,
  getMateFields,
} from '../../shared/mateFeature.ts'
import { getCigarTypeLabel, isInterbaseType } from '../../shared/types.ts'
import {
  openCigarWidget,
  openCoverageWidget,
  openIndicatorWidget,
  openModificationWidget,
} from '../components/detailWidgets.ts'
import { viewMateRegionInCurrentView } from '../viewMateRegion.ts'

import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { FilterBy } from '../../shared/types.ts'
import type { ContextMenuHit } from '../components/hitTestPipeline.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const SortByTagDialog = lazy(() => import('../dialogs/SortByTagDialog.tsx'))

type LGV = LinearGenomeViewModel

// What the CIGAR / modification / indicator items need, and no more. Split from
// the read-level surface below because LGVSyntenyDisplay reuses only these — a
// PAF block has no mate, tags, name or sequence, so making it satisfy the read
// half to reach `getHitMenuItems` was a type it had to fake rather than have.
interface HitMenuModel extends IStateTreeNode {
  // What the right-click landed on, as one value. Captured once when the menu
  // is built so its onClicks operate on a snapshot — closeContextMenu runs
  // before the click callback, so reading it live would see undefined.
  contextMenuHit: ContextMenuHit | undefined
  setSortedByAtPosition: (arg: {
    type: string
    pos: number
    refName: string
    tag?: string
  }) => void
}

// Just enough to resolve the read the menu was opened over — what
// `withContextMenuFeature` and `copyFeatureInfo` take, so an extension point
// that only wants those two doesn't declare a hit-test surface it never reads.
interface FeatureLookupModel extends IStateTreeNode {
  withFeatureById: (
    featureId: string,
    onFeat: (feat: Feature) => void,
  ) => Promise<void>
}

// The read/tag quick-filter rows read and merge into the same slot, and nothing
// else.
interface FilterModel {
  filterBy: FilterBy
  setFilterBy: (filterBy: FilterBy) => void
}

interface ContextMenuModel
  extends HitMenuModel, FeatureLookupModel, FilterModel {
  // The read under the cursor, known only after a GetPileupFeatureDetails round
  // trip — so it is undefined for the first paint of every menu. Items that can
  // be built from the id alone must not gate on it (see withContextMenuFeature).
  contextMenuFeature: Feature | undefined
  // The same read's id, carried by the hit test and so known synchronously.
  contextMenuFeatureId: string | undefined
  // The active ordering, read only to pre-fill the tag dialog so this entry
  // point and the track menu's "Tag..." open with the same field filled.
  sortedBy?: { type: string; tag?: string }
  selectFeature: (feature: Feature) => void
}

// Act on the read the menu was opened over. `feat` is the fetched feature as
// captured when this menu was built: the fetch landing re-runs the menu builder,
// so by the time anything is clicked it is normally in hand and this is
// synchronous. The id path covers the narrow case of a click that beats the RPC.
// Neither can be read live inside the onClick — closeContextMenu clears both
// before the callback fires.
export function withContextMenuFeature(
  self: FeatureLookupModel,
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
function setTagFilter(self: FilterModel, tag: string, value: string) {
  const others = (self.filterBy.tagFilters ?? []).filter(f => f.tag !== tag)
  self.setFilterBy({
    ...self.filterBy,
    tagFilters: [...others, { tag, value }],
  })
}

// The whole feature as JSON, minus the synthetic uniqueId — the "all fields"
// copy, shared with the displays that offer it as a top-level item rather than
// inside a Copy submenu (LGVSyntenyDisplay, whose PAF block has no read name or
// sequence to copy beside it).
export function copyFeatureInfo(self: IStateTreeNode, feat: Feature) {
  const { uniqueId: _uniqueId, ...rest } = feat.toJSON()
  void copyText(self, JSON.stringify(rest, null, 4), 'feature info')
}

// Cigar and coverage-indicator hits build the identical two-item submenu: sort
// the pileup by what's under the cursor, or open its details widget. `block` is
// captured once by getHitMenuItems and closed over by the onClicks because
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
  self: HitMenuModel
  block: ResolvedBlock
  label: string
  sortLabel: string
  sortType: string
  position: number
  detailsLabel: string
  openDetails: () => void
  sort: boolean
}): MenuItem {
  const detailsItem = {
    label: detailsLabel,
    icon: MenuOpenIcon,
    onClick: () => {
      openDetails()
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
              self.setSortedByAtPosition({
                type: sortType,
                pos: position,
                refName: block.refName,
              })
            },
          },
          detailsItem,
        ],
      }
    : detailsItem
}

// The tags worth a one-click filter, and what to call each in the row. A closed
// list rather than a walk of the read's tags: these two are the ones a reader
// narrows a pileup by, and offering every tag on the read (NM, AS, ms, de…)
// would bury them. A third is one entry here.
const QUICK_TAG_FILTERS = [
  { tag: 'HP', noun: 'haplotype' },
  { tag: 'RG', noun: 'read group' },
]

// Quick per-read filters (read name / HP / RG) plus a clear item, shown only
// when a filter is active. Each coexists with the others (setTagFilter merges).
function getFilterSubMenu(self: FilterModel, feat: Feature): MenuItem[] {
  const readName = feat.get('name')
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
  for (const { tag, noun } of QUICK_TAG_FILTERS) {
    const value = getReadTag(feat, tag)
    if (value !== undefined) {
      sub.push({
        label: `Filter for this ${noun} (${tag}:${value})`,
        icon: FilterAltIcon,
        onClick: () => {
          setTagFilter(self, tag, value)
        },
      })
    }
  }
  const hasReadOrTagFilter =
    self.filterBy.readName !== undefined ||
    self.filterBy.spliced !== undefined ||
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
function getCopySubMenu(self: IStateTreeNode, feat: Feature): MenuItem[] {
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
    const locString = assembleLocString({
      refName,
      start: feat.get('start'),
      end: feat.get('end'),
    })
    sub.push({
      label: 'Copy location',
      onClick: () => {
        void copyText(self, locString, 'location')
      },
    })
  }
  if (seq) {
    sub.push({
      label: 'Copy read sequence',
      onClick: () => {
        void copyText(self, String(seq), 'read sequence')
      },
    })
  }
  sub.push({
    label: 'Copy feature info as JSON',
    onClick: () => {
      copyFeatureInfo(self, feat)
    },
  })
  return sub
}

// Items for what sits under the cursor — the CIGAR op, the modified base, the
// coverage bar and its interbase indicator — as opposed to the read the cursor
// is over. Nothing here reads a read/pair field, so LGVSyntenyDisplay (which
// draws the same mismatch and interbase layers off a PAF cs/CIGAR) reuses them,
// with `sort: false` since its sort menu offers no position-anchored mode.
export function getHitMenuItems(
  self: HitMenuModel,
  { sort = true }: { sort?: boolean } = {},
): MenuItem[] {
  // Snapshotted here, whole, because closeContextMenu clears it before any
  // onClick fires. Every item below names the block's refName (the aggregate
  // widgets also its rpcData), and the hit arrives with its block or not at all,
  // so one gate covers them — rather than some items vanishing and others
  // rendering with a dead onClick.
  const menuHit = self.contextMenuHit
  const items: MenuItem[] = []

  if (menuHit) {
    const { block, genomicPos, cigarHit, indicatorHit, modHit, coverageHit } =
      menuHit
    if (cigarHit) {
      const typeLabel = getCigarTypeLabel(cigarHit.type)
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
          // An interbase mark IS its position, so the sort anchors on the mark.
          // A base-pair sort anchors on the clicked COLUMN instead: a deletion
          // or skip reports `position` as the op's start, which for a 5kb
          // deletion or a 100kb intron is a locus that can be off screen — and
          // it silently disagreed with the read menu's own "Sort by ▸ Base
          // pair" in the same menu, which has always meant the clicked column.
          // A mismatch is 1bp, so the two are the same base there.
          position: isInterbase ? cigarHit.position : genomicPos,
          // Named with its span, so "Open deletion details" beside a
          // feature-level "Open feature details" reads as the CIGAR op the
          // cursor is on rather than as an unexplained second kind of detail. A
          // mismatch is 1bp by construction and says nothing.
          detailsLabel: `Open ${typeLabel.toLowerCase()} details${
            cigarHit.length > 1
              ? ` (${cigarHit.length.toLocaleString()} bp)`
              : ''
          }`,
          openDetails: () => {
            openCigarWidget(self, cigarHit, block.refName)
          },
          sort,
        }),
      )
    }

    // A modified base opens its per-read modification widget from the menu too —
    // reachable on a plain modified base, where there's no cigarHit submenu
    // above. snpBase annotates the widget when the modified base is also a SNP,
    // mirroring the left-click path.
    if (modHit) {
      const snpBase = snpBaseFromCigar(cigarHit)
      items.push({
        label: 'Open modification details',
        icon: MenuOpenIcon,
        onClick: () => {
          openModificationWidget(self, modHit, block.refName, snpBase)
        },
      })
    }

    if (indicatorHit) {
      const typeLabel = getCigarTypeLabel(indicatorHit.indicatorType)
      items.push(
        sortAndDetailsSubMenu({
          self,
          block,
          label: `Coverage ${typeLabel}`,
          sortLabel: `Sort by ${typeLabel.toLowerCase()} at position`,
          sortType: indicatorHit.indicatorType,
          position: indicatorHit.position,
          detailsLabel: `Open ${typeLabel.toLowerCase()} details`,
          openDetails: () => {
            openIndicatorWidget(
              self,
              indicatorHit,
              block.refName,
              block.rpcData,
            )
          },
          sort,
        }),
      )
    }

    // The depth histogram itself, which a left-click has always opened
    // (`openCoverageWidget`) while a right-click on it fell through to the
    // browser's menu — the one mark with something to offer that offered
    // nothing. Sorting the pileup by the base at a coverage column is also the
    // thing this band is right-clicked FOR, and it had no home: the track
    // menu's "Sort by ▸ Base pair" anchors on the center line, not on the
    // column whose bar you are pointing at.
    //
    // Anchored on the hit's own position rather than the raw cursor column,
    // matching the widget the details item opens: zoomed out past 1bp/px
    // `hitTestCoverage` snaps to a significant SNP inside the bin, which is the
    // column a reader pointing at a coloured bar means.
    if (coverageHit) {
      items.push(
        sortAndDetailsSubMenu({
          self,
          block,
          label: 'Coverage',
          sortLabel: 'Sort by base at position',
          sortType: 'basePair',
          position: coverageHit.position,
          detailsLabel: 'Open coverage details',
          openDetails: () => {
            openCoverageWidget(
              self,
              coverageHit.position,
              block.refName,
              block.rpcData,
            )
          },
          sort,
        }),
      )
    }
  }

  return items
}

// Right-click menu over the pileup: the hit items above, plus mate-view,
// filter, copy and feature-detail actions for the read itself. Split out of the
// model to mirror trackMenuItems (menus/index.ts).
//
// `sort` false drops every position-anchored sort, the same option
// `getHitMenuItems` takes — for chain mode, whose rows are chains and whose
// layout is handed no `sortedBy` at all, so the items would set a slot nothing
// reads (the track menu's "Sort by..." is gated on the same condition).
export function getContextMenuItems(
  self: ContextMenuModel,
  { sort = true }: { sort?: boolean } = {},
): MenuItem[] {
  const feat = self.contextMenuFeature
  const featureId = self.contextMenuFeatureId
  const menuHit = self.contextMenuHit
  const items = getHitMenuItems(self, { sort })

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
    if (sort && menuHit) {
      const { genomicPos: pos, block } = menuHit
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
              getDialogHost(self).queueDialog(handleClose => [
                SortByTagDialog,
                {
                  handleClose,
                  initialTag:
                    self.sortedBy?.type === 'tag'
                      ? self.sortedBy.tag
                      : undefined,
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
                mate: mateFields,
              })
            },
          },
          // gated like every other launch site: `@jbrowse/react-linear-genome-view`
          // bundles this plugin without breakpoint-split-view, and an ungated row
          // there opens the choice dialog only to fail on `addView` once the
          // reader has answered it
          ...(hasBreakpointSplitView(self)
            ? [
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
              ]
            : []),
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
