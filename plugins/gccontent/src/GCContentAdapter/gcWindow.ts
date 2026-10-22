import type { ZoomRange } from '@jbrowse/core/data_adapters/BaseAdapter'

export const WINDOW_DEFAULT = 100
export const AUTO_STEP = 'auto'

export type GCStep = number | typeof AUTO_STEP

// 1 -> 2 -> 5 -> 10 -> 20 -> ..., exact in floating point at every rung
const RUNG_GROWTH = [2, 2.5, 2]

/**
 * The step an `auto` step resolves to: the largest 1/2/5 rung at or under the
 * bp one point covers at this zoom, so a view draws one to two and a half
 * points per pixel at `resolution` 1, the wiggle display's points per pixel.
 * Every zoom inside a rung resolves to the same step, and `zoomRange` is that
 * interval, so the display refetches only when the zoom crosses a rung.
 */
export function autoStep(bpPerPx: number, resolution = 1) {
  const bpPerPoint = bpPerPx / resolution
  let rung = 1
  let next = 2
  for (let i = 1; next <= bpPerPoint; i++) {
    rung = next
    next = rung * RUNG_GROWTH[i % 3]!
  }
  return {
    step: rung,
    zoomRange: {
      minBpPerPx: rung === 1 ? 0 : rung * resolution,
      maxBpPerPx: next * resolution,
    } satisfies ZoomRange,
  }
}

/**
 * The window and step the adapter scores with: whole bases, at least 1, and a
 * window at least as wide as the step, so every base lands in a window. An
 * `auto` step with no zoom to follow tiles the windows.
 */
export function resolveGCWindow({
  window,
  step,
  bpPerPx,
  resolution,
}: {
  window: number
  step: GCStep
  bpPerPx?: number
  resolution?: number
}) {
  const bpPerPoint = (bpPerPx ?? 0) / (resolution ?? 1)
  const auto =
    step === AUTO_STEP && bpPerPoint > 0 && Number.isFinite(bpPerPoint)
      ? autoStep(bpPerPx!, resolution)
      : undefined
  const fixedWindow = Math.max(1, Math.round(window))
  const resolvedStep = auto
    ? auto.step
    : step === AUTO_STEP
      ? fixedWindow
      : Math.max(1, Math.round(step))
  return {
    window: Math.max(fixedWindow, resolvedStep),
    step: resolvedStep,
    zoomRange: auto?.zoomRange,
  }
}
