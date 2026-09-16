// Its own module rather than `types.ts` beside it: the payload types that
// carry a zoom range — `markEncodingTypes.ts`, `regionCommit.ts`,
// wiggle-core's `dataTypes.ts` — are leaves `scripts/moduleClosure.test.ts`
// holds a ceiling on, and `BaseOptions` puts the status and abort graph in
// `types.ts`.

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
