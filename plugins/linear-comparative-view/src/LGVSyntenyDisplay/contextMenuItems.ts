import { getConf } from '@jbrowse/core/configuration'
import { LAUNCH_LABEL } from '@jbrowse/core/ui'
import {
  getContainingTrack,
  getNotificationSink,
  getSession,
} from '@jbrowse/core/util'
import {
  copyFeatureInfo,
  withContextMenuFeature,
} from '@jbrowse/plugin-alignments'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LineStyleIcon from '@mui/icons-material/LineStyle'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SyncAltIcon from '@mui/icons-material/SyncAlt'

import { anchorPanelTracks } from '../LaunchSyntenyView/anchorPanelTracks.ts'
import {
  openMateInLinearView,
  openMateLabel,
} from '../LaunchSyntenyView/openMateInLinearView.ts'
import { pairwiseSyntenyLaunch } from '../LaunchSyntenyView/pairwiseSyntenyLaunch.ts'
import { syntenyRegionMenuItems } from '../LaunchSyntenyView/regionLaunchMenuItems.ts'
import { getCigar, getMate } from '../syntenyMate.ts'
import {
  containingPanelStack,
  matePanelIndexes,
  moveMatePanels,
} from './matePanelNavigation.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  // here. Duck-typed to those two fields rather than importing the alignments
  // display's `ContextMenuHit`: this menu asks nothing about which mark
  // answered.
  contextMenuHit:
    | { block: { bpRange: [number, number]; refName: string } }
    | undefined
  view: LinearGenomeViewModel
  selectFeature: (feature: Feature) => void
  withFeatureById: (
    featureId: string,
    onFeat: (feat: Feature) => void,
  ) => Promise<void>
}

// The visible block the user right-clicked in: what the launch dialog offers to
// clip the synteny view to, what the move maps across, and what the multi-panel
// launch reads back out of the dataset.
type ClickedBlock = NonNullable<
  SyntenyContextMenuModel['contextMenuHit']
>['block']

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
  block: ClickedBlock | undefined,
): MenuItem[] {
  const launch = pairwiseSyntenyLaunch({
    host: getSession(self),
    feature,
    anchorView: self.view,
    track: getContainingTrack(self).configuration,
    region: block
      ? { start: block.bpRange[0], end: block.bpRange[1] }
      : undefined,
    // ...so the launched view can take this one's place rather than stacking
    // below it, showing the same locus twice
    sourceView: self.view,
  })
  return launch
    ? [
        {
          label: 'Launch synteny view for this position',
          icon: CompareArrowsIcon,
          onClick: launch,
        },
      ]
    : []
}

/**
 * The multi-panel launch, from the same right-click: a row for every assembly
 * the clicked block's window aligns to in this dataset, not just the mate of
 * the alignment under the cursor.
 *
 * Only on a track declaring three or more assemblies. On a pairwise track the
 * region launch discovers the one mate the item above already offers, so the
 * second entry would be the first with a fetch in front of it. A one-vs-all
 * track whose extra mates are undeclared PanSN samples is the same case: those
 * cannot open a panel whichever route is taken.
 *
 * The lane track is the only dataset offered — the region launch from the view
 * menu lists every open synteny track, but a click on this track's block means
 * this track. The pairwise item above and the panel-move below need the feature;
 * this needs only the block, and the assemblies gate reads config, so it could
 * be offered before the fetch lands — it is not, so the three launch-shaped
 * items arrive together rather than the menu reordering under the cursor.
 */
function launchAllAssembliesItem(
  self: SyntenyContextMenuModel,
  block: ClickedBlock | undefined,
): MenuItem[] {
  const view = self.view
  const assemblyName = view.assemblyNames[0]
  const track = getContainingTrack(self)
  const declared = new Set(getConf(track, 'assemblyNames') as string[])
  if (!block || assemblyName === undefined || declared.size < 3) {
    return []
  }
  return syntenyRegionMenuItems({
    label: 'Launch synteny view for all assemblies here',
    region: {
      assemblyName,
      refName: block.refName,
      start: block.bpRange[0],
      end: block.bpRange[1],
    },
    session: getSession(self),
    openTracks: [track.configuration],
    anchorTracks: anchorPanelTracks(view.tracks),
    sourceView: view,
  })
}

/**
 * The mate assembly on its own, at the matching region — a jump rather than a
 * comparison, the way a MAF row and a graph node open a strain. Offered for any
 * loaded assembly, declared by the track or not.
 */
function openMateItem(
  self: SyntenyContextMenuModel,
  feature: Feature,
  block: ClickedBlock | undefined,
): MenuItem[] {
  const mate = openMateInLinearView({
    host: getSession(self),
    feature,
    anchorView: self.view,
    region: block
      ? { start: block.bpRange[0], end: block.bpRange[1] }
      : undefined,
  })
  return mate
    ? [
        {
          label: openMateLabel(mate.assemblyName),
          icon: LineStyleIcon,
          onClick: () => {
            mate.open().catch((e: unknown) => {
              getNotificationSink(self).notifyError(`${e}`, e)
            })
          },
        },
      ]
    : []
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
  block: ClickedBlock | undefined,
): MenuItem[] {
  const view = self.view
  const stack = containingPanelStack(view)
  if (!stack || !block || !getCigar(feature)) {
    return []
  }
  const anchorIndex = stack.views.indexOf(view)
  const indexes = matePanelIndexes({
    panelAssemblies: stack.views.map(v => v.assemblyNames[0]),
    anchorIndex,
    mateAssemblyName: getMate(feature)?.assemblyName,
    assemblyManager: getSession(self).assemblyManager,
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
              anchorIndex,
              indexes,
              feature,
              region: { start: block.bpRange[0], end: block.bpRange[1] },
              session: getSession(self),
            }).catch((e: unknown) => {
              getNotificationSink(self).notifyError(`${e}`, e)
            })
          },
        },
      ]
    : []
}

/**
 * Everything LGVSyntenyDisplay's right-click menu adds to the shared hit items:
 * two items from the id alone, then the ones that need the fetched feature.
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
  // Snapshotted here rather than read in an onClick because closeContextMenu
  // nulls it first.
  const block = self.contextMenuHit?.block
  // The three ways out into another view read alike back to back, so they sit
  // under one heading; the move stays outside it, since it changes this view.
  const launches = [
    ...launchSyntenyItem(self, feature, block),
    ...launchAllAssembliesItem(self, block),
    ...openMateItem(self, feature, block),
  ]
  return [
    ...featureDetailItems(self, featureId, feature),
    ...(launches.length
      ? [{ type: 'subHeader' as const, label: LAUNCH_LABEL }, ...launches]
      : []),
    ...movePanelItem(self, feature, block),
  ]
}
