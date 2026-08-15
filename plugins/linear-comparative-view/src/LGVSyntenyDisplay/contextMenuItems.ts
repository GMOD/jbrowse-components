import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import {
  copyFeatureInfo,
  withContextMenuFeature,
} from '@jbrowse/plugin-alignments'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SyncAltIcon from '@mui/icons-material/SyncAlt'

import { anchorPanelTracks } from '../LaunchSyntenyView/anchorPanelTracks.ts'
import { canLaunchSyntenyForMate } from '../LaunchSyntenyView/canLaunchSyntenyForMate.ts'
import { getCigar, getMate } from '../syntenyMate.ts'
import {
  containingPanelStack,
  matePanelIndexes,
  moveMatePanels,
} from './matePanelNavigation.ts'

import type { RegionOfInterest } from '../LaunchSyntenyView/resolvePanel.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LaunchSyntenyViewDialog = lazy(
  () => import('../LaunchSyntenyView/LaunchSyntenyViewDialog.tsx'),
)

// The feature half of LGVSyntenyDisplay's right-click menu, kept out of the
// model so the model's `.views()` block holds the method rather than the menu.
// `IStateTreeNode` and not a plain shape: every item here reaches the session,
// the containing track or the display's own feature lookup.
interface SyntenyContextMenuModel extends IStateTreeNode {
  // The id the hit test carries, known synchronously, and the feature behind it,
  // which arrives an RPC later — see `featureMenuItems`.
  contextMenuFeatureId: string | undefined
  contextMenuFeature: Feature | undefined
  // What the right-click landed on, of which only the visible block is read
  // here. Duck-typed to that one field rather than importing the alignments
  // display's `ContextMenuHit`: this menu asks nothing about which mark
  // answered.
  contextMenuHit: { block: { bpRange: [number, number] } } | undefined
  lgv: LinearGenomeViewModel
  selectFeature: (feature: Feature) => void
  withFeatureById: (
    featureId: string,
    onFeat: (feat: Feature) => void,
  ) => Promise<void>
}

/**
 * Open the feature's details, and copy them — the two items that need nothing
 * but the id.
 *
 * KEYED ON THE ID, which the hit test carries, rather than on
 * `contextMenuFeature`, which arrives an RPC later: a right-click on a CIGAR op
 * otherwise opened a menu holding only its hit item, and the feature items
 * appeared afterwards (or, on a whole-block re-read, long afterwards). What
 * actually needs the feature resolves it in its own onClick — normally already
 * in hand by then.
 */
function featureDetailItems(
  self: SyntenyContextMenuModel,
  featureId: string,
  feature: Feature | undefined,
): MenuItem[] {
  return [
    {
      label: 'Open feature details',
      icon: MenuOpenIcon,
      onClick: () => {
        withContextMenuFeature(self, featureId, feature, feat => {
          self.selectFeature(feat)
        })
      },
    },
    {
      label: 'Copy info to clipboard',
      icon: ContentCopyIcon,
      onClick: () => {
        withContextMenuFeature(self, featureId, feature, feat => {
          copyFeatureInfo(self, feat)
        })
      },
    },
  ]
}

/**
 * Build a whole synteny view around this alignment.
 *
 * Can't be offered from the id alone: whether a synteny view can open depends
 * on the mate's assembly, which is per-feature (a one-vs-all mate can be a PanSN
 * sample that is no declared assembly of the track). So it waits for the fetch
 * rather than offering a view that would fail to open — and sits last, so
 * arriving late appends to the menu instead of shifting the items already under
 * the cursor.
 */
function launchSyntenyItem(
  self: SyntenyContextMenuModel,
  feature: Feature,
  region: RegionOfInterest | undefined,
): MenuItem[] {
  const view = self.lgv
  // The anchor panel opens on the view's own assembly, which is what the
  // features were fetched against — more dependable than the feature's own
  // `assemblyName` field, which not every adapter sets.
  const anchorAssembly = view.assemblyNames[0]
  const track = getContainingTrack(self)
  if (
    anchorAssembly === undefined ||
    !canLaunchSyntenyForMate(
      getConf(track, 'assemblyNames'),
      getMate(feature)?.assemblyName,
    )
  ) {
    return []
  }
  return [
    {
      label: 'Launch synteny view for this position',
      icon: CompareArrowsIcon,
      onClick: () => {
        getSession(self).queueDialog(handleClose => [
          LaunchSyntenyViewDialog,
          {
            region,
            trackId: getConf(track, 'trackId'),
            handleClose,
            session: getSession(self),
            anchorAssembly,
            // the anchor panel opens on this view's assembly, so it can open on
            // this view's tracks too — this chain track excluded, since it
            // becomes the ribbon band
            anchorTracks: anchorPanelTracks(view.tracks),
            // ...and so the launched view can take this one's place rather than
            // stacking below it, showing the same locus twice
            sourceView: view,
            feature,
          },
        ])
      },
    },
  ]
}

/**
 * The in-place twin of the launch: same alignment, same region of interest, but
 * instead of building a new view it moves the panel next to this one to the
 * region the alignment says corresponds.
 *
 * ITS OWN GATE, not the launch's. It used to be nested inside one, which cost
 * it the case it is most useful in: an all-vs-all track's mate can be a PanSN
 * sample the track does not declare in `assemblyNames` (the adapter's own docs
 * say so), and the launch is rightly hidden for those — but if a NEIGHBOURING
 * PANEL IS ALREADY OPEN on that sample, moving it is perfectly well defined and
 * was silently unavailable. What this actually needs is below, and the panel
 * check is the strict one: `matePanelIndexes` only names a neighbour already
 * showing the mate's assembly.
 *
 * Only where this view IS a panel of a stack — in a standalone linear view
 * there is nothing to move, and launching is the whole answer.
 *
 * AND ONLY WITH A CIGAR TO WALK. Without one, `resolvedMateSpan` interpolates
 * across the block — which is the right answer for the launch, whose dialog pads
 * the result by a window size and shows what it resolved, but not for this: this
 * navigates a neighbouring panel and parks it flush against this one, which
 * presents a straight-line guess as a correspondence with nothing on screen to
 * say so. A minimap2 PAF without `-c`, MashMap, MCScan and a PIF's coarse tier
 * all carry no CIGAR, and on the coarse tier the skew is not even bounded by its
 * 10 kb split threshold — smaller indels accumulate without triggering a split.
 * The band's own right-click menu gates on the same thing via
 * `featureData.hasCigar`.
 */
function movePanelItem(
  self: SyntenyContextMenuModel,
  feature: Feature,
  region: RegionOfInterest | undefined,
): MenuItem[] {
  const view = self.lgv
  const stack = containingPanelStack(view)
  if (!stack || !region || !getCigar(feature)) {
    return []
  }
  const indexes = matePanelIndexes({
    panelAssemblies: stack.views.map(v => v.assemblyNames[0]),
    anchorIndex: stack.views.indexOf(view),
    mateAssemblyName: getMate(feature)?.assemblyName,
  })
  return indexes.length
    ? [
        {
          label:
            indexes.length > 1
              ? 'Move other panels to the matching region'
              : 'Move other panel to the matching region',
          icon: SyncAltIcon,
          onClick: () => {
            moveMatePanels({
              stack,
              indexes,
              feature,
              region,
              session: getSession(self),
            })
          },
        },
      ]
    : []
}

/**
 * Everything LGVSyntenyDisplay's right-click menu adds to the shared hit items:
 * two items from the id alone, then the two that need the fetched feature.
 */
export function featureMenuItems(self: SyntenyContextMenuModel): MenuItem[] {
  const featureId = self.contextMenuFeatureId
  if (featureId === undefined) {
    return []
  }
  const feature = self.contextMenuFeature
  if (!feature) {
    return featureDetailItems(self, featureId, feature)
  }
  // The visible block the user right-clicked in, which the launch dialog offers
  // to clip the synteny view to and which the move maps across. Snapshotted here
  // rather than read in an onClick because closeContextMenu nulls it first, and
  // taken from the click rather than searched for by refName: a feature abutting
  // a region boundary overlaps two visible blocks, and only the cursor says
  // which one it was drawn in.
  const block = self.contextMenuHit?.block
  const region = block
    ? { start: block.bpRange[0], end: block.bpRange[1] }
    : undefined
  return [
    ...featureDetailItems(self, featureId, feature),
    ...launchSyntenyItem(self, feature, region),
    ...movePanelItem(self, feature, region),
  ]
}
