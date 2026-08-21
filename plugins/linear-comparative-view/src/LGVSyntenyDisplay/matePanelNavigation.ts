import { assembleLocStringRaw } from '@jbrowse/core/util'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import { isViewModel } from '@jbrowse/core/util/types'
import { getParent, hasParent } from '@jbrowse/mobx-state-tree'

import { resolvedMateSpan } from '../LaunchSyntenyView/resolvePanel.ts'
import { getCigar } from '../syntenyMate.ts'

import type { RegionOfInterest } from '../LaunchSyntenyView/resolvePanel.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// A stack of genome panels, one above the next: LinearSyntenyView,
// LinearComparativeView and BreakpointSplitView are each one. Duck-typed rather
// than imported, because what reaches this file is a display inside one of the
// panels and a panel has no idea which kind of stack it is in.
export interface PanelStack {
  views: LinearGenomeViewModel[]
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
 */
export function matePanelLocString(
  feature: Feature,
  region: RegionOfInterest,
): string | undefined {
  if (!getCigar(feature)) {
    return undefined
  }
  const span = resolvedMateSpan(feature, region)
  return span
    ? assembleLocStringRaw({
        refName: span.refName,
        start: span.start,
        end: span.end,
      })
    : undefined
}

/**
 * Send each named panel to the region this alignment matches. `navToLocString`
 * rather than `navTo`, so a neighbour showing some other contig switches
 * displayed regions instead of throwing, and it is awaited only to report the
 * failure — an assembly still loading is the ordinary reason one takes a tick.
 */
export function moveMatePanels({
  stack,
  indexes,
  feature,
  region,
  session,
}: {
  stack: PanelStack
  indexes: number[]
  feature: Feature
  region: RegionOfInterest
  session: AbstractSessionModel
}) {
  const locString = matePanelLocString(feature, region)
  if (!locString) {
    return
  }
  for (const i of indexes) {
    const panel = stack.views[i]
    if (panel) {
      panel.navToLocString(locString).catch((e: unknown) => {
        session.notifyError(`${e}`, e)
      })
    }
  }
}
