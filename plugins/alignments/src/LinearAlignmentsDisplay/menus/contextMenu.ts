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
import { CIGAR_TYPE_LABELS } from '../components/alignmentComponentUtils.ts'
import {
  openCigarWidget,
  openIndicatorWidget,
} from '../components/detailWidgets.ts'
import { viewMateRegionInCurrentView } from '../viewMateRegion.ts'

import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type {
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'
import type { FilterBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface ContextMenuModel extends IAnyStateTreeNode {
  contextMenuFeature: Feature | undefined
  contextMenuCigarHit: CigarHitResult | undefined
  contextMenuIndicatorHit: IndicatorHitResult | undefined
  // The block under the right-click (refName + worker result + bp range), the
  // single source of the position sort's refName and the indicator widget's
  // rpcData. Captured once when the menu is built so its onClicks operate on a
  // snapshot — clearContextMenu runs before the click callback, so reading it
  // live would see undefined.
  contextMenuBlock: ResolvedBlock | undefined
  filterBy: FilterBy
  setFilterBy: (filterBy: FilterBy) => void
  setSortedByAtPosition: (type: string, pos: number, refName: string) => void
  selectFeature: (feature: Feature) => void
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

// Right-click menu over the pileup: sort/details for the CIGAR op or coverage
// indicator under the cursor, plus mate-view and feature-detail actions for the
// read itself. Split out of the model to mirror trackMenuItems (menus/index.ts).
export function getContextMenuItems(self: ContextMenuModel): MenuItem[] {
  const feat = self.contextMenuFeature
  const cigarHit = self.contextMenuCigarHit
  const indicatorHit = self.contextMenuIndicatorHit
  const block = self.contextMenuBlock
  const items: MenuItem[] = []

  if (cigarHit) {
    const typeLabel = CIGAR_TYPE_LABELS[cigarHit.type] ?? cigarHit.type
    const isInterbase = ['insertion', 'softclip', 'hardclip'].includes(
      cigarHit.type,
    )
    const sortType = isInterbase ? cigarHit.type : 'basePair'
    const sortLabel = isInterbase
      ? `Sort by ${typeLabel.toLowerCase()} at position`
      : 'Sort by base at position'
    items.push({
      label: typeLabel,
      type: 'subMenu',
      subMenu: [
        {
          label: sortLabel,
          icon: SwapVertIcon,
          onClick: () => {
            if (block) {
              self.setSortedByAtPosition(
                sortType,
                cigarHit.position,
                block.refName,
              )
            }
          },
        },
        {
          label: `Open ${typeLabel.toLowerCase()} details`,
          icon: MenuOpenIcon,
          onClick: () => {
            if (block) {
              openCigarWidget(self, cigarHit, block.refName)
            }
          },
        },
      ],
    })
  }

  if (indicatorHit) {
    const typeLabel =
      CIGAR_TYPE_LABELS[indicatorHit.indicatorType] ??
      indicatorHit.indicatorType
    items.push({
      label: `Coverage ${typeLabel}`,
      type: 'subMenu',
      subMenu: [
        {
          label: `Sort by ${typeLabel.toLowerCase()} at position`,
          icon: SwapVertIcon,
          onClick: () => {
            if (block) {
              self.setSortedByAtPosition(
                indicatorHit.indicatorType,
                indicatorHit.position,
                block.refName,
              )
            }
          },
        },
        {
          label: `Open ${typeLabel.toLowerCase()} details`,
          icon: MenuOpenIcon,
          onClick: () => {
            if (block) {
              openIndicatorWidget(
                self,
                indicatorHit,
                block.refName,
                block.rpcData,
              )
            }
          },
        },
      ],
    })
  }

  if (feat) {
    items.push({
      label: 'Open feature details',
      icon: MenuOpenIcon,
      onClick: () => {
        self.selectFeature(feat)
      },
    })
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
    const readName = feat.get('name')
    const hp = getReadTag(feat, 'HP')
    const rg = getReadTag(feat, 'RG')
    const filterSubMenu: MenuItem[] = []
    if (readName) {
      filterSubMenu.push({
        label: 'Filter for this read',
        icon: FilterAltIcon,
        onClick: () => {
          self.setFilterBy({ ...self.filterBy, readName })
        },
      })
    }
    if (hp !== undefined) {
      filterSubMenu.push({
        label: `Filter for this haplotype (HP:${hp})`,
        icon: FilterAltIcon,
        onClick: () => {
          setTagFilter(self, 'HP', hp)
        },
      })
    }
    if (rg !== undefined) {
      filterSubMenu.push({
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
      filterSubMenu.push({
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
    if (filterSubMenu.length) {
      items.push({
        label: 'Filter',
        icon: FilterAltIcon,
        type: 'subMenu',
        subMenu: filterSubMenu,
      })
    }
    const seq = feat.get('seq')
    const copySubMenu: MenuItem[] = []
    if (readName) {
      copySubMenu.push({
        label: 'Copy read name',
        onClick: () => {
          void copyText(self, String(readName), 'read name')
        },
      })
    }
    const refName = feat.get('refName')
    if (refName) {
      const locString = `${refName}:${feat.get('start') + 1}-${feat.get('end')}`
      copySubMenu.push({
        label: 'Copy location',
        subLabel: 'e.g. to paste into the location search box',
        onClick: () => {
          void copyText(self, locString, 'location')
        },
      })
    }
    if (seq) {
      copySubMenu.push({
        label: 'Copy read sequence',
        subLabel: 'raw read bases, e.g. to paste into BLAT/BLAST',
        onClick: () => {
          void copyText(self, String(seq), 'read sequence')
        },
      })
    }
    copySubMenu.push({
      label: 'Copy feature info',
      subLabel: 'all fields as JSON',
      onClick: () => {
        const { uniqueId, ...rest } = feat.toJSON()
        void copyText(self, JSON.stringify(rest, null, 4), 'feature info')
      },
    })
    items.push({
      label: 'Copy',
      icon: ContentCopyIcon,
      type: 'subMenu',
      subMenu: copySubMenu,
    })
  }

  return items
}
