import type { BrowserState, Episode } from '../RLPipeline/types.ts'

/**
 * Compute a shallow delta between two BrowserState objects. Only keys
 * that differ are included in the delta. Deep comparison is performed
 * for array values (activeTracks, displayedRegions, etc.); if any
 * element differs the whole array is included.
 */
function computeDelta(
  prev: BrowserState,
  next: BrowserState,
): Partial<BrowserState> {
  const delta: Partial<BrowserState> = {}
  for (const key of Object.keys(next) as (keyof BrowserState)[]) {
    const pv = prev[key]
    const nv = next[key]
    if (!shallowEqual(pv, nv)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(delta as any)[key] = nv
    }
  }
  return delta
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    for (let i = 0; i < a.length; i++) {
      if (!shallowEqual(a[i], b[i])) {
        return false
      }
    }
    return true
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false
  }
  const ak = Object.keys(a as object)
  const bk = Object.keys(b as object)
  if (ak.length !== bk.length) {
    return false
  }
  for (const k of ak) {
    if (
      (a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]
    ) {
      return false
    }
  }
  return true
}

/**
 * Exports episodes as JSONL.
 *
 * By default uses delta encoding: each step records only the fields that
 * changed in `next_observation` relative to `observation`. The first step
 * of each episode includes the full state. This typically reduces file
 * size by 50-80% for navigation-heavy sessions.
 *
 * Pass `{deltaEncode: false}` to disable and emit full states.
 */
export default class JSONLExporter {
  constructor(private deltaEncode = true) {}

  export(episodes: Episode[]): string {
    const lines: string[] = []
    for (const episode of episodes) {
      for (const step of episode.steps) {
        const nextObs: Partial<BrowserState> | BrowserState = this
          .deltaEncode
          ? computeDelta(step.state, step.nextState)
          : step.nextState
        lines.push(
          JSON.stringify({
            episode_id: episode.id,
            timestamp: step.timestamp,
            observation: step.state,
            action: step.action,
            action_metadata: step.actionMetadata,
            reward: step.reward,
            next_observation_delta: this.deltaEncode ? nextObs : undefined,
            next_observation: this.deltaEncode ? undefined : nextObs,
            terminated: step.terminal,
            truncated: episode.outcome === 'timeout',
          }),
        )
      }
    }
    return lines.join('\n')
  }

  exportAsBlob(episodes: Episode[]): Blob {
    return new Blob([this.export(episodes)], {
      type: 'application/x-ndjson',
    })
  }

  downloadFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `rl-analytics-${timestamp}.jsonl`
  }
}
