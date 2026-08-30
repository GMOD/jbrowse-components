import { spy } from 'mobx'

/**
 * Counts how many times each `observer` component re-rendered, without
 * instrumenting a single component.
 *
 * `mobx-react-lite` names every function component's reaction
 * `observer<ComponentName>`, and `Reaction.track` — which wraps the render
 * itself, not just the invalidation — emits a `{ type: 'reaction' }` spy event
 * each time it runs. So a spy filtered to those events IS the per-component
 * render count: integers, deterministic, one run, no browser.
 *
 * That matters because the alternative is a CPU profile, which
 * `agent-docs/reference/INTERACTION_PERF.md` records as truncated (22 of ~920
 * sampled frames), machine-dependent, and needing a rebuild per arm. This sees
 * the quantity that profile keeps pointing at — how many components React
 * re-runs per frame — directly.
 *
 * Two things it does not see, and a budget written against it should not claim
 * otherwise. A child re-rendered purely by its parent passing fresh props runs
 * no reaction of its own, and `mobx` reports spy events only in its development
 * build. Both make a count here a FLOOR on React's real work.
 */
export interface RenderCensus {
  /** Stop counting. Idempotent. */
  stop: () => void
  /** Reaction runs since the last `reset`, by reaction name. */
  counts: () => Map<string, number>
  /** Observer-component renders only, keyed by component name. */
  components: () => Map<string, number>
  /** Total observer-component renders. */
  total: () => number
  reset: () => void
  /** Ranked `count  name` lines, for a probe to print. */
  report: (limit?: number) => string
}

const OBSERVER = 'observer'

export function censusRenders(): RenderCensus {
  let counts = new Map<string, number>()
  const dispose = spy(event => {
    if (event.type === 'reaction') {
      const { name } = event
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  })
  const components = () => {
    const out = new Map<string, number>()
    for (const [name, n] of counts) {
      if (name.startsWith(OBSERVER)) {
        out.set(name.slice(OBSERVER.length), n)
      }
    }
    return out
  }
  return {
    stop: dispose,
    counts: () => new Map(counts),
    components,
    total: () => [...components().values()].reduce((a, b) => a + b, 0),
    reset: () => {
      counts = new Map()
    },
    report: (limit = 40) =>
      [...counts]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, n]) => `${String(n).padStart(6)}  ${name}`)
        .join('\n'),
  }
}
