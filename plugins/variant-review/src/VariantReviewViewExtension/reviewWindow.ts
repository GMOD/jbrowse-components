import type { CandidateVariant } from '../candidates/types.ts'

export interface ReviewWindow {
  start: number
  end: number
  // the event is wider than `maxWindowBp`, so this is the default span at its
  // start rather than the whole event
  exceeded: boolean
}

/**
 * The viewport for a candidate: `span` bp centred on its sort column (the
 * column's middle, not its left edge), or the whole event plus 10% each side
 * when it is wider than `span`, up to `maxWindowBp`.
 */
export function reviewWindow(
  c: Pick<CandidateVariant, 'start' | 'end' | 'sort'>,
  span: number,
  maxWindowBp: number,
): ReviewWindow {
  const length = c.end - c.start
  const around = (centre: number, exceeded: boolean) => ({
    start: Math.max(0, Math.floor(centre - span / 2)),
    end: Math.ceil(centre + span / 2),
    exceeded,
  })
  if (length > span) {
    const pad = 0.1 * length
    const start = c.start - pad
    const end = c.end + pad
    return end - start > maxWindowBp
      ? around(c.start + 0.5, true)
      : {
          start: Math.max(0, Math.floor(start)),
          end: Math.ceil(end),
          exceeded: false,
        }
  }
  return around((c.sort?.pos ?? c.start) + 0.5, false)
}
