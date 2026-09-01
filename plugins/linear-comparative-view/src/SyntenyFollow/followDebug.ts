/* eslint-disable no-console */
// What each level's settled pass decided, in one line per level. OFF unless
// `localStorage.debugSyntenyFollow` is set, and read per call so it can be
// turned on against a session already open.
//
// It is here rather than deleted with the investigation that wanted it because
// the numbers this prints are the only way to see the rung decision from
// outside: which rung, off which windows, how much of the placed row is answer.
// The sparse-spread report was diagnosed by adding exactly this and driving the
// live demo with `browser-tests/follow-spread-probe.ts`, and the next report
// about a row landing somewhere odd wants it again.
import { untracked } from 'mobx'

import { followAnchorWindows } from './followAnchorWindow.ts'
import { coversContig, partialShare, pxByRefName } from './spreadDecision.ts'

import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function on() {
  try {
    return !!localStorage.getItem('debugSyntenyFollow')
  } catch {
    // storage can be denied outright, and a diagnostic may not be the thing
    // that takes the view down with it
    return false
  }
}

const span = (s: FollowWindow) =>
  `${s.refName}:${Math.round(s.start)}-${Math.round(s.end)}`

const bp = (spans: FollowWindow[]) =>
  spans.reduce((a, s) => a + (s.end - s.start), 0)

// what the anchor panel actually has on screen, in px, before any floor
function panel(view: LinearGenomeViewModel) {
  const widths = pxByRefName(view.coarseDynamicBlocks)
  const widest = Math.max(...widths.values())
  return [...widths.entries()]
    .sort((a, b2) => b2[1] - a[1])
    .map(
      ([name, px]) =>
        `${name} ${Math.round(px)}px ${Math.round((px / widest) * 100)}%`,
    )
    .join(', ')
}

// WHOLE or PARTIAL against the region it sits in, px-weighted, by the very
// rule the decision applies — a second spelling printed "partial" for a window
// the decision had judged whole, which is the log disagreeing with the thing it
// exists to explain.
function wholeness(view: LinearGenomeViewModel, windows: FollowWindow[]) {
  const regions = view.displayedRegions
  const parts = windows.map(
    w => `${w.refName} ${coversContig(w, regions) ? 'WHOLE' : 'partial'}`,
  )
  const share = partialShare({
    blocks: view.coarseDynamicBlocks,
    regions,
    windows,
  })
  return `${parts.join(', ')} — partial by px: ${Math.round(share * 100)}%`
}

// visible bp of a row, which for a spread placement is the interval the union
// forced — the denominator of the coverage the fix would threshold on
function shown(view: LinearGenomeViewModel) {
  const blocks = view.dynamicBlocks.contentBlocks
  return {
    contigs: [...new Set(blocks.map(b => b.refName))],
    bp: blocks.reduce((a, b) => a + (b.end - b.start), 0),
  }
}

// UNTRACKED, all of it: this runs inside the exact pass's autorun, and rung 3
// deliberately does not read its moving row — a debug read would add the
// dependency and change the thing being measured.
export function logFollowSpread({
  stayingView,
  movingView,
  windows,
  carried,
  spans,
  decision,
}: {
  stayingView: LinearGenomeViewModel
  movingView: LinearGenomeViewModel
  windows: FollowWindow[]
  carried: boolean
  spans: ResolvedSpan[]
  decision: { spreading: boolean; onto?: string; coverage?: number }
}) {
  if (!on()) {
    return
  }
  // eslint-disable-next-line no-restricted-syntax -- instrumentation
  const after = untracked(() => shown(movingView))
  const mapped = bp(spans)
  console.log(
    // eslint-disable-next-line no-restricted-syntax -- instrumentation
    `${untracked(
      () =>
        `[follow] SPREAD ${stayingView.assemblyNames[0]} -> ${movingView.assemblyNames[0]}`,
    )}\n` +
      `  anchor panel: ${panel(stayingView)}\n` +
      `  windows (${carried ? 'carried' : 'off blocks'}) x${windows.length}: ${windows.map(w => span(w)).join(', ')}\n` +
      `  kept by the floor: ${followAnchorWindows(stayingView.coarseDynamicBlocks).length}\n` +
      // eslint-disable-next-line no-restricted-syntax -- instrumentation
      `  wholeness: ${untracked(() => wholeness(stayingView, windows))}\n` +
      `  spans x${spans.length}: ${spans.map(s => span(s)).join(', ')}\n` +
      `  placed on ${after.contigs.length} contigs, ${(after.bp / 1e6).toFixed(1)}Mb: ${after.contigs.join(', ')}\n` +
      `  mapped ${(mapped / 1e6).toFixed(1)}Mb of that = ${Math.round((mapped / after.bp) * 100)}% covered\n` +
      `  DECISION: ${decision.spreading ? 'spread' : `demote onto ${decision.onto}`}${decision.coverage === undefined ? '' : ` (measured ${Math.round(decision.coverage * 100)}%)`}`,
  )
}

export function logFollowStep({
  stayingView,
  movingView,
  window,
  carried,
  rung,
  target,
}: {
  stayingView: LinearGenomeViewModel
  movingView: LinearGenomeViewModel
  window: FollowWindow
  carried: boolean
  rung: string
  target?: string
}) {
  if (!on()) {
    return
  }
  console.log(
    // eslint-disable-next-line no-restricted-syntax -- instrumentation
    `${untracked(
      () =>
        `[follow] ${rung} ${stayingView.assemblyNames[0]} -> ${movingView.assemblyNames[0]}`,
    )}\n` +
      `  anchor panel: ${panel(stayingView)}\n` +
      `  window (${carried ? 'carried' : 'off blocks'}): ${span(window)}\n` +
      `  incumbent target: ${target ?? 'none'}`,
  )
}
