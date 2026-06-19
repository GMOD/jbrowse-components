import { when } from 'mobx'

import type { WiggleDataResult } from './dataTypes.ts'
import type { YScaleTicks } from './index.ts'
import type { WiggleRenderingBackend } from './renderingBackendTypes.ts'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderLifecycleModel } from '@jbrowse/core/util/useRenderingBackend'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

// Intersection contract every wiggle-family GPU display model (wiggle,
// multi-wiggle, manhattan) exposes to its React component. RenderingBackend-typed for
// narrowing; TData lets specialized displays (e.g. manhattan) declare their
// rpcDataMap value shape instead of using WiggleDataResult.
export interface WiggleGpuDisplayModel<
  TRenderingBackend = WiggleRenderingBackend,
  TData = WiggleDataResult,
> extends RenderLifecycleModel<TRenderingBackend> {
  rpcDataMap: ReadonlyMap<number, TData>
  ticks?: YScaleTicks
  canvasDrawn: boolean
  height: number
  error: Error | null
  isLoading: boolean
  displayPhase: DisplayPhase
  loadingOverlayVisible: boolean
  statusMessage?: string
  reload: () => void
  regionTooLarge: boolean
  regionTooLargeReason: string
  featureDensityStats?: FeatureDensityStats
  setFeatureDensityStatsLimit: (s?: FeatureDensityStats) => void
  forceLoad: () => void
  displayCrossHatches: boolean
  scalebarOverlapLeft: number
}

// SVG export and any other off-screen renderer must wait until the display has
// reached a terminal state before reading its data. That whole policy lives in
// the `svgReady` getter (MultiRegionDisplayMixin) so it stays in one place and
// out of the renderers; this just awaits it.
export function waitForRenderableState(model: { svgReady: boolean }) {
  return when(() => model.svgReady)
}
