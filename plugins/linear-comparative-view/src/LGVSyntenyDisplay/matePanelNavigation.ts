import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import { isViewModel } from '@jbrowse/core/util/types'
import { getParent, hasParent } from '@jbrowse/mobx-state-tree'

import { resolvedMateSpan } from '../LaunchSyntenyView/resolvePanel.ts'
import { movePanelsToSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import {
  captureStackViewports,
  noFollowAnchor,
  takeFollowAnchor,
} from '../LinearSyntenyViewHelper/offscreenMateNav.ts'
import { getCigar } from '../syntenyMate.ts'

import type { RegionOfInterest } from '../LaunchSyntenyView/resolvePanel.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'
import type {
  IAnyStateTreeNode,
  IStateTreeNode,
} from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// A stack of genome panels, one above the next: LinearSyntenyView,
// LinearComparativeView and BreakpointSplitView are each one. Duck-typed rather
// than imported, because what reaches this file is a display inside one of the
// panels and a panel has no idea which kind of stack it is in.
export interface PanelStack extends IStateTreeNode {
  views: LinearGenomeViewModel[]
  // The follow state, OPTIONAL because only two of the three stacks have it: a
  // LinearSyntenyView and a LinearComparativeView can be following,
  // BreakpointSplitView has no such mode.
  followSynteny?: boolean
  followAnchorIndex?: number
  setFollowAnchorIndex?: (idx: number) => void
}

/**
 * A stack that has the follow at all, whether or not it is switched on.
 *
 * The three properties are one fact, so they are tested as one: with them
 * declared independently optional, a stack carrying `followSynteny` but no
 * setter would take an optional call and write nothing, which is the follow
 * quietly not being taken rather than an error. Whether the follow is ON is
 * `takeFollowAnchor`'s decision and stays there — this only answers whether
 * there is anything to ask.
 */
type FollowingStack = PanelStack &
  Required<
    Pick<
      PanelStack,
      'followSynteny' | 'followAnchorIndex' | 'setFollowAnchorIndex'
    >
  >

function isFollowingStack(stack: PanelStack): stack is FollowingStack {
  return (
    typeof stack.followSynteny === 'boolean' &&
    typeof stack.followAnchorIndex === 'number' &&
    typeof stack.setFollowAnchorIndex === 'function'
  )
}

/**
 * The stack `lgv` is a panel of, or undefined when it is a view in its own
 * right.
 *
 * Both halves of the test are load-bearing. Membership alone is not enough:
 * the SESSION has a `views` array, and a top-level linear view is in it, so a
 * membership-only walk reports the session as the panel's stack — and the
 * neighbours it then offers to move are whatever unrelated views the user
 * happens to have open. `isViewModel` alone is not enough either: it would
 * match the first view-shaped ancestor whether or not this view is one of its
 * panels.
 */
export function containingPanelStack(
  lgv: LinearGenomeViewModel,
): PanelStack | undefined {
  let node: IAnyStateTreeNode = lgv
  while (hasParent(node)) {
    node = getParent<IAnyStateTreeNode>(node)
    const { views } = node as { views?: unknown }
    if (
      isViewModel(node) &&
      Array.isArray(views) &&
      (views as unknown[]).includes(lgv)
    ) {
      return node as unknown as PanelStack
    }
  }
  return undefined
}

/**
 * Which panels of a stack a "move to the matching region" from `anchorIndex`
 * moves.
 *
 * Only the panels ADJACENT to the anchor, and only those already open on the
 * mate's assembly. A synteny band is drawn between adjacent panels only, so
 * those are the panels this alignment says anything about — the far panel of a
 * three-row stack is related to the anchor through some other level's
 * alignments, and moving it from this one would be a guess. Filtering on the
 * assembly is what keeps a stack of three different genomes from sending a
 * neighbour to a refName it does not have.
 *
 * A self-alignment (both panels on one assembly, a genome against its own
 * haplotype or paralogy) passes that filter in both directions, which is the
 * case this exists for.
 *
 * The assembly test is alias-aware, and has to be: a panel holds the name the
 * session opened it on while a mate holds the one the adapter resolved out of
 * the track's `assemblyNames`, so the two spell one assembly differently often
 * enough. `panelAssemblies` stays index-aligned with `stack.views` — it is
 * indexed by panel position and carries `undefined` for a view that has not
 * initialized — which is why this resolves each name in place rather than
 * mapping the list through `canonicalAssemblyNames`, whose empty-name filter
 * would shift every index after the first gap.
 */
export function matePanelIndexes({
  panelAssemblies,
  anchorIndex,
  mateAssemblyName,
  assemblyManager,
}: {
  panelAssemblies: (string | undefined)[]
  anchorIndex: number
  mateAssemblyName: string | undefined
  assemblyManager: AssemblyNameResolver
}): number[] {
  if (mateAssemblyName === undefined) {
    return []
  }
  return [anchorIndex - 1, anchorIndex + 1].filter(
    i =>
      i >= 0 &&
      i < panelAssemblies.length &&
      isSameAssemblyName(panelAssemblies[i], mateAssemblyName, assemblyManager),
  )
}

/**
 * The locstring a neighbouring panel is sent to: the slice of the mate the
 * alignment puts opposite `region`, which is the anchor panel's visible window
 * rather than the whole alignment.
 *
 * That distinction is the whole point. A published liftOver-style chain is one
 * feature tens of Mb long, so its midpoint — what "Center on feature" moves to
 * — is nowhere near what is on screen, and its full extent is nothing a panel
 * can usefully show. `resolvedMateSpan` walks the CIGAR to place just the
 * visible window on the other assembly, the same resolution the launch dialog
 * previews and the launched view opens on.
 *
 * The span, not its midpoint, so the neighbour matches this panel's SCALE too
 * and the ribbons between them come back near-vertical. Reverse-strand
 * alignments are deliberately not opened reversed: the crossed ribbon is how an
 * inversion reads, and flipping a panel the user did not ask to flip hides it.
 *
 * NO CIGAR, NO ANSWER. `resolvedMateSpan` will happily interpolate across a
 * block instead of walking it, and for the LAUNCH that is right — its dialog
 * pads the result by a window size and shows what it resolved. This navigates a
 * neighbouring panel and parks it flush against the anchor, where a
 * straight-line guess reads as a correspondence and nothing on screen says
 * otherwise. The refusal lives here rather than only in the menu so that every
 * caller inherits it; the menu gates on the same thing so the item is absent
 * rather than inert.
 *
 * A SPAN AND NOT A LOCSTRING, which is what lets the caller reach
 * `navToResolvedSpan`. Stringifying here forced `navToLocString`, and that
 * REPLACES the moved panel's `displayedRegions` with the one contig it landed on
 * — so a panel showing a whole genome was narrowed by its own first move, and
 * the synteny fetch keeps a block only when both ends are in view, which is the
 * ribbons it was moved to line up.
 */
export function matePanelSpan(
  feature: Feature,
  region: RegionOfInterest,
): ResolvedSpan | undefined {
  const span = getCigar(feature) ? resolvedMateSpan(feature, region) : undefined
  return span
    ? { refName: span.refName, start: span.start, end: span.end }
    : undefined
}

/**
 * Send each named panel to the region this alignment matches.
 *
 * `navToResolvedSpan` rather than a bare `navToLocString`: it tries `navTo`
 * first, which moves WITHIN the panel's existing regions, and falls back to the
 * locstring only for a span the panel genuinely cannot reach. The bare call
 * replaced `displayedRegions` whether or not it needed to, which narrows a
 * whole-genome panel to one contig permanently — see `matePanelSpan`. Awaited
 * only to report the failure; an assembly still loading is the ordinary reason
 * one takes a tick.
 *
 * IT TAKES THE FOLLOW ANCHOR FIRST, when the stack is following and the clicked
 * panel is not already the anchor. A panel the follow MOVES is re-asserted onto
 * the anchor's mapping the moment it settles, and the navigation below is what
 * wakes that pass — so without the take this ran, moved the neighbour, and the
 * follow pulled it straight back. Anchoring the clicked panel is what the click
 * MEANS: this panel stays, the others come to it, which is the item's own label.
 * `showOffscreenMateContig` states the rule at length.
 *
 * `takeFollowAnchor` itself rather than the two conditions restated here, which
 * is what a stack with no follow at all needs `isFollowingStack` for.
 * `movePanelsToSpan` owns the rest: the release when nothing landed, and the
 * Undo for a panel that could only be moved by replacing its regions.
 */
export async function moveMatePanels({
  stack,
  anchorIndex,
  indexes,
  feature,
  region,
  session,
}: {
  stack: PanelStack
  // the clicked panel, which stays put — and becomes the follow's anchor
  anchorIndex: number
  indexes: number[]
  feature: Feature
  region: RegionOfInterest
  session: AbstractSessionModel
}) {
  const span = matePanelSpan(feature, region)
  if (span) {
    // captured before the take, which already re-places the other panels
    const restore = captureStackViewports([...stack.views])
    const anchor = isFollowingStack(stack)
      ? takeFollowAnchor(stack, anchorIndex)
      : noFollowAnchor()
    await movePanelsToSpan({
      panels: indexes
        .map(i => stack.views[i])
        .filter(panel => panel !== undefined),
      span,
      anchor,
      restore,
      session,
      followNote: 'and following this panel',
    })
  }
}
