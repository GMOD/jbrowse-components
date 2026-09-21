/* eslint-disable no-console */
// What each level's settled pass decided, while
// `localStorage.debugSyntenyFollow` is set: the one view of the rung decision
// from outside. `browser-tests/follow-spread-probe.ts` drives a live session
// with it.
import { untracked } from 'mobx'

import { followAnchorWindows } from './followAnchorWindow.ts'
import { coversContig, partialShare } from './spreadDecision.ts'

import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { AnchorWindow, FollowWindow } from './followAnchorWindow.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function on() {
  try {
    return !!localStorage.getItem('debugSyntenyFollow')
  } catch {
    return false
  }
}

const span = (s: FollowWindow) =>
  `${s.refName}:${Math.round(s.start)}-${Math.round(s.end)}`

const bp = (spans: FollowWindow[]) =>
  spans.reduce((a, s) => a + (s.end - s.start), 0)

// what the anchor panel actually has on screen, in px, before any floor
function panel(view: LinearGenomeViewModel) {
  const widths = new Map<string, number>()
  for (const b of view.dynamicBlocks.contentBlocks) {
    widths.set(b.refName, (widths.get(b.refName) ?? 0) + b.widthPx)
  }
  const widest = Math.max(...widths.values())
  return [...widths.entries()]
    .sort((a, b2) => b2[1] - a[1])
    .map(
      ([name, px]) =>
        `${name} ${Math.round(px)}px ${Math.round((px / widest) * 100)}%`,
    )
    .join(', ')
}

// by the rule the decision applies, so the log cannot disagree with it
function wholeness(view: LinearGenomeViewModel, windows: AnchorWindow[]) {
  const regions = view.displayedRegions
  const parts = windows.map(
    w => `${w.refName} ${coversContig(w, regions) ? 'WHOLE' : 'partial'}`,
  )
  const share = partialShare({ regions, windows })
  return `${parts.join(', ')} — partial by px: ${Math.round(share * 100)}%`
}

function shown(view: LinearGenomeViewModel) {
  const blocks = view.dynamicBlocks.contentBlocks
  return {
    contigs: [...new Set(blocks.map(b => b.refName))],
    bp: blocks.reduce((a, b) => a + (b.end - b.start), 0),
  }
}

// untracked: both logs run inside the exact pass's autorun
export function logFollowSpread({
  stayingView,
  movingView,
  windows,
  measured,
  spans,
  decision,
}: {
  stayingView: LinearGenomeViewModel
  movingView: LinearGenomeViewModel
  windows: FollowWindow[]
  measured?: AnchorWindow[]
  spans: ResolvedSpan[]
  decision: { spreading: boolean; onto?: string; coverage?: number }
}) {
  if (!on()) {
    return
  }
  const mapped = bp(spans)
  // eslint-disable-next-line no-restricted-syntax -- instrumentation
  const message = untracked(() => {
    const after = shown(movingView)
    return (
      `[follow] SPREAD ${stayingView.assemblyNames[0]} -> ${movingView.assemblyNames[0]}\n` +
      `  anchor panel: ${panel(stayingView)}\n` +
      `  windows (${measured ? 'off blocks' : 'carried'}) x${windows.length}: ${windows.map(w => span(w)).join(', ')}\n` +
      `  kept by the floor: ${followAnchorWindows(stayingView.dynamicBlocks.contentBlocks).length}\n` +
      `  wholeness: ${measured ? wholeness(stayingView, measured) : 'carried'}\n` +
      `  spans x${spans.length}: ${spans.map(s => span(s)).join(', ')}\n` +
      `  placed on ${after.contigs.length} contigs, ${(after.bp / 1e6).toFixed(1)}Mb: ${after.contigs.join(', ')}\n` +
      `  mapped ${(mapped / 1e6).toFixed(1)}Mb of that = ${Math.round((mapped / after.bp) * 100)}% covered\n` +
      `  DECISION: ${decision.spreading ? 'spread' : `demote onto ${decision.onto}`}${decision.coverage === undefined ? '' : ` (measured ${Math.round(decision.coverage * 100)}%)`}`
    )
  })
  console.log(message)
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
  // eslint-disable-next-line no-restricted-syntax -- instrumentation
  const message = untracked(
    () =>
      `[follow] ${rung} ${stayingView.assemblyNames[0]} -> ${movingView.assemblyNames[0]}\n` +
      `  anchor panel: ${panel(stayingView)}\n` +
      `  window (${carried ? 'carried' : 'off blocks'}): ${span(window)}\n` +
      `  incumbent target: ${target ?? 'none'}`,
  )
  console.log(message)
}
