/**
 * #api
 * The bp/px interval, `[minBpPerPx, maxBpPerPx)`, over which an adapter with
 * zoom levels answers a fetch from the same level it answered `opts.bpPerPx`
 * from. A display holding the answer refetches when the view leaves it.
 */
export interface ZoomRange {
  minBpPerPx: number
  maxBpPerPx: number
}
