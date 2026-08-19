import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'

export interface OffscreenMateStubs {
  data: OffscreenMateData
  bpPerPx: number
  offsetPx: number
}

// The structural slice the overlay reads, so what decides where a stub lands is
// checkable without a canvas — which jsdom does not give one of anyway.
interface StubSource {
  level: number
  linearSyntenyDisplays: {
    featureData?: { offscreenMates: OffscreenMateData }
  }[]
  parentView: {
    showOffscreenMates: boolean
    views: { bpPerPx: number; offsetPx: number }[]
  }
}

/**
 * What this level has to mark, and the ruler to mark it against.
 *
 * THE LEVEL'S OWN INDEX IS THE QUERY ROW. A synteny level sits between rows
 * `level` and `level + 1`, and these are placed on the query axis because that
 * is the only axis they have — an off-screen mate is precisely an alignment with
 * no position on the row below. Reading the lower row here would draw every stub
 * against the wrong ruler, at a plausible-looking offset that nothing else in
 * the view disagrees with.
 *
 * Empty when the toggle is off, so the overlay clears its canvas and stops
 * rather than the caller branching around the whole draw.
 */
export function offscreenMateStubs(model: StubSource): OffscreenMateStubs[] {
  const { parentView } = model
  const view = parentView.views[model.level]
  if (!parentView.showOffscreenMates || !view) {
    return []
  }
  const { bpPerPx, offsetPx } = view
  return model.linearSyntenyDisplays
    .map(d => d.featureData?.offscreenMates)
    .filter(data => data !== undefined)
    .filter(data => data.starts.length > 0)
    .map(data => ({ data, bpPerPx, offsetPx }))
}
