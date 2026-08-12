import { useFetch } from '../util/useFetch.ts'
import {
  getFullGraphicsCapabilities,
  getGraphicsCapabilities,
} from './getGraphicsCapabilities.ts'

/**
 * `full` resolves the WebGL2 rung even when WebGPU already decided the ladder,
 * at the cost of one WebGL2 context per page — for a caller that lists every
 * backend rather than naming the one in use. Both probes are memoized, so a
 * dialog reopening costs nothing either way.
 */
export function useGraphicsCapabilities({ full = false } = {}) {
  const { data } = useFetch(['graphicsCapabilities', full], () =>
    full ? getFullGraphicsCapabilities() : getGraphicsCapabilities(),
  )
  return data ?? null
}
