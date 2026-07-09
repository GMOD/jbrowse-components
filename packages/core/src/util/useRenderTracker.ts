/* eslint-disable no-console -- opt-in debug instrument: console.table/debug are the point */
/* eslint-disable @eslint-react/purity -- deliberately samples performance.now() during render to time re-render churn */
import { useRef } from 'react'

import {
  localStorageGetBoolean,
  localStorageGetItem,
} from './localStorage.ts'

// Opt-in React re-render instrumentation. Zero-cost when off: the flags are read
// once at module load, so every call site collapses to a constant branch.
//
//   localStorage.debugRenders = 'true'          // count renders, table every 3s
//   localStorage.debugRendersVerbose = 'true'   // also log every render's Δ
//   localStorage.debugRendersFilter = 'ZoomTransform,Overlays'
//                                               // scope verbose to these labels
//   window.jbrowseRenderStats()                 // dump the table on demand
//   window.jbrowseRenderStatsReset()            // zero the counters
//
// Verbose line: `[render] ZoomTransform#3 +7.9ms Δ offsetPx`
//   • #3            — instance id (stable per mounted component)
//   • +7.9ms        — time since this instance's previous render. A sub-ms gap
//                     is React.StrictMode's synchronous double-invoke (ignore
//                     it); a several-ms gap is a genuinely separate commit.
//   • Δ …           — which tracked values changed (empty Δ = re-rendered
//                     without any tracked value changing, e.g. a parent
//                     re-render or an untracked observable)
//
// The table columns:
//   total          — renders since reset (summed across every instance)
//   recent         — renders since the previous table dump
//   instances      — distinct mounted instances of this component seen
//   max/inst/frame — most renders a SINGLE instance did within one animation
//                    frame. This is the redundancy signal, and it's per-instance
//                    so "N mounted instances" doesn't masquerade as churn.
//
// IMPORTANT: in a dev build the app runs under React.StrictMode, which invokes
// every render twice. So the clean baseline for max/inst/frame is 2, not 1:
//   • max/inst/frame == 2  → one real render per frame (StrictMode double) — the
//                            component IS the animation, nothing to fix
//   • max/inst/frame  > 2  → an instance renders redundantly within a frame — a
//                            real, cheap win; turn on verbose to see the Δ reason

const ENABLED = localStorageGetBoolean('debugRenders', false)
const VERBOSE = localStorageGetBoolean('debugRendersVerbose', false)
const FILTER = new Set(
  (localStorageGetItem('debugRendersFilter') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
)

interface Stat {
  count: number
  firstMs: number
  lastMs: number
  reported: number
  // per-instance renders accumulated since the last animation-frame sample
  frameByInstance: Map<number, number>
  instances: Set<number>
  maxPerInstanceFrame: number
  // per-instance timestamp of the previous render, for the verbose +dt readout
  lastRenderByInstance: Map<number, number>
}

function newStat(now: number): Stat {
  return {
    count: 0,
    firstMs: now,
    lastMs: now,
    reported: 0,
    frameByInstance: new Map(),
    instances: new Set(),
    maxPerInstanceFrame: 0,
    lastRenderByInstance: new Map(),
  }
}

declare global {
  interface Window {
    jbrowseRenderStats?: () => void
    jbrowseRenderStatsReset?: () => void
  }
}

const stats = new Map<string, Stat>()
let nextInstanceId = 1
let reporterStarted = false

// Runs every animation frame while tracking is enabled. Reduces each component
// to the worst single-instance render count in the frame, so genuine per-frame
// redundancy is visible without multiple instances inflating it.
function sampleFrame() {
  for (const s of stats.values()) {
    for (const perFrame of s.frameByInstance.values()) {
      if (perFrame > s.maxPerInstanceFrame) {
        s.maxPerInstanceFrame = perFrame
      }
    }
    s.frameByInstance.clear()
  }
  requestAnimationFrame(sampleFrame)
}

function dump() {
  const rows = [...stats.entries()]
    .map(([label, s]) => {
      const spanSec = (s.lastMs - s.firstMs) / 1000
      return {
        label,
        total: s.count,
        recent: s.count - s.reported,
        'renders/sec': spanSec > 0 ? +(s.count / spanSec).toFixed(1) : 0,
        instances: s.instances.size,
        'max/inst/frame': s.maxPerInstanceFrame,
      }
    })
    .sort((a, b) => b.recent - a.recent || b.total - a.total)
  for (const s of stats.values()) {
    s.reported = s.count
  }
  if (rows.length > 0) {
    console.table(rows)
  }
}

function startReporter() {
  if (!reporterStarted && typeof window !== 'undefined') {
    reporterStarted = true
    window.jbrowseRenderStats = () => {
      dump()
    }
    window.jbrowseRenderStatsReset = () => {
      stats.clear()
    }
    requestAnimationFrame(sampleFrame)
    setInterval(() => {
      // only auto-dump when something rendered since the last dump, so an idle
      // app doesn't reprint the same table every 3s
      for (const s of stats.values()) {
        if (s.count > s.reported) {
          dump()
          break
        }
      }
    }, 3000)
  }
}

function changedKeys(
  prev: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
) {
  const changed: string[] = []
  if (prev) {
    for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      if (prev[k] !== next[k]) {
        changed.push(k)
      }
    }
  }
  return changed
}

// Call once per render. `props` is optional and only used when the verbose flag
// is set, to report which incoming values changed since the previous render.
export function useRenderTracker(
  label: string,
  props?: Record<string, unknown>,
) {
  const prevPropsRef = useRef<Record<string, unknown> | undefined>(undefined)
  const instanceIdRef = useRef(0)
  if (ENABLED) {
    if (instanceIdRef.current === 0) {
      instanceIdRef.current = nextInstanceId++
    }
    const id = instanceIdRef.current
    const now = performance.now()
    const existing = stats.get(label)
    const stat = existing ?? newStat(now)
    stat.count += 1
    stat.lastMs = now
    stat.instances.add(id)
    stat.frameByInstance.set(id, (stat.frameByInstance.get(id) ?? 0) + 1)
    if (!existing) {
      stats.set(label, stat)
    }
    startReporter()
    if (VERBOSE && (FILTER.size === 0 || FILTER.has(label))) {
      const prevMs = stat.lastRenderByInstance.get(id)
      const dt = prevMs === undefined ? 0 : now - prevMs
      const changed = props ? changedKeys(prevPropsRef.current, props) : []
      console.debug(
        `[render] ${label}#${id} +${dt.toFixed(1)}ms Δ ${changed.join(', ') || '(none tracked)'}`,
      )
      if (props) {
        prevPropsRef.current = { ...props }
      }
    }
    stat.lastRenderByInstance.set(id, now)
  }
}
