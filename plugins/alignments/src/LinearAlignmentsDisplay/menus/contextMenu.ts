import { getContainingView, getSession } from '@jbrowse/core/util'
import { launchBreakpointSplitView } from '@jbrowse/sv-core'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import { buildPairedEndMateFeature, getMateFields } from '../../shared/mateFeature.ts'
import { CIGAR_TYPE_LABELS } from '../components/alignmentComponentUtils.ts'
import {
  openCigarWidget,
  openIndicatorWidget,
} from '../components/detailWidgets.ts'
import { viewMateRegionInCurrentView } from '../viewMateRegion.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types'
import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface ContextMenuModel extends IAnyStateTreeNode {
  contextMenuFeature: Feature | undefined
  contextMenuCigarHit: CigarHitResult | undefined
  contextMenuIndicatorHit: IndicatorHitResult | undefined
  contextMenuRefName: string | undefined
  contextMenuRpcData: PileupDataResult | undefined
  setSortedByAtPosition: (type: string, pos: number, refName: string) => void
  selectFeature: (feature: Feature) => void
}

// Right-click menu over the pileup: sort/details for the CIGAR op or coverage
// indicator under the cursor, plus mate-view and feature-detail actions for the
// read itself. Split out of the model to mirror trackMenuItems (menus/index.ts).
export function getContextMenuItems(self: ContextMenuModel): MenuItem[] {
  const feat = self.contextMenuFeature
  const cigarHit = self.contextMenuCigarHit
  const indicatorHit = self.contextMenuIndicatorHit
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
            if (self.contextMenuRefName) {
              self.setSortedByAtPosition(
                sortType,
                cigarHit.position,
                self.contextMenuRefName,
              )
            }
          },
        },
        {
          label: `Open ${typeLabel.toLowerCase()} details`,
          icon: MenuOpenIcon,
          onClick: () => {
            if (self.contextMenuRefName) {
              openCigarWidget(self, cigarHit, self.contextMenuRefName)
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
            if (self.contextMenuRefName) {
              self.setSortedByAtPosition(
                indicatorHit.indicatorType,
                indicatorHit.position,
                self.contextMenuRefName,
              )
            }
          },
        },
        {
          label: `Open ${typeLabel.toLowerCase()} details`,
          icon: MenuOpenIcon,
          onClick: () => {
            if (self.contextMenuRefName) {
              openIndicatorWidget(
                self,
                indicatorHit,
                self.contextMenuRefName,
                self.contextMenuRpcData,
              )
            }
          },
        },
      ],
    })
  }

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
    items.push(
      {
        label: 'Open feature details',
        icon: MenuOpenIcon,
        onClick: () => {
          self.selectFeature(feat)
        },
      },
      {
        label: 'Copy info to clipboard',
        icon: ContentCopyIcon,
        onClick: async () => {
          const session = getSession(self)
          try {
            const { uniqueId, ...rest } = feat.toJSON()
            const { default: copy } = await import(
              '@jbrowse/core/util/copyToClipboard'
            )
            copy(JSON.stringify(rest, null, 4))
            session.notify('Copied to clipboard', 'success')
          } catch (e) {
            console.error(e)
            session.notifyError(`${e}`, e)
          }
        },
      },
    )
  }

  return items
}
