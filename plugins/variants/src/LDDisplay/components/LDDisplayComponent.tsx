import { useEffect } from 'react'

import { useMouseState } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getBpDisplayStr, stringify } from '@jbrowse/core/util'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import Crosshairs from './Crosshairs.tsx'
import FocalSnpHighlight from './FocalSnpHighlight.tsx'
import LDColorLegend from './LDColorLegend.tsx'
import LDColumnZone from './LDColumnZone.tsx'
import { LDRenderer } from './LDRenderer.ts'
import LDStatusBar from './LDStatusBar.tsx'
import { ldMetricLabel, ldValueText } from './ldColorRamp.ts'

import type { LDFlatbushItem } from '../../RenderLDDataRPC/types.ts'
import type { SharedLDModel } from '../shared.ts'
import type { MouseTracker } from '@jbrowse/core/ui'

function SnpRow({ snp }: { snp: LDFlatbushItem['snp1'] }) {
  return (
    <div>
      {snp.id ? <b>{snp.id} </b> : null}
      {/* the shared coordinate readout, not a hand-rolled +1 and
          toLocaleString: it honours the numberGrouping display preference and
          shortens the refName, which a bare toLocaleString does neither of */}
      {stringify({ refName: snp.refName, coord: snp.start + 1 })}
      {snp.maf === undefined ? null : ` · MAF ${snp.maf.toFixed(3)}`}
    </div>
  )
}

function LDTooltip({
  item,
  x,
  y,
  ldMetric,
  ldMethod,
  signedLD,
}: {
  item: LDFlatbushItem
  x: number
  y: number
  ldMetric: string
  ldMethod: string | undefined
  signedLD: boolean
}) {
  const distance = Math.abs(item.snp1.start - item.snp2.start)
  // Sign only carries meaning when signed values were requested; positive =
  // coupling (alleles co-occur), negative = repulsion (opposite haplotypes).
  const phase =
    signedLD && item.ldValue !== 0
      ? item.ldValue > 0
        ? ' (coupling)'
        : ' (repulsion)'
      : ''

  return (
    <BaseTooltip clientPoint={{ x, y }}>
      <SnpRow snp={item.snp1} />
      <SnpRow snp={item.snp2} />
      <div>
        {ldMetricLabel(ldMetric, signedLD)}:{' '}
        {ldValueText(item.ldValue, ldMetric, ldMethod)}
        {phase}
      </div>
      <div>Distance: {getBpDisplayStr(distance)}</div>
    </BaseTooltip>
  )
}

const LDCanvas = observer(function LDCanvas({
  model,
  canvasRef,
  mouseTracker,
}: {
  model: SharedLDModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  mouseTracker: MouseTracker
}) {
  // The pointer is read here, not beside the handlers in the component that
  // mounts the chrome: there it would re-render `DisplayChrome` and all three
  // status overlays on every mousemove (see `useMouseTracking`). This component
  // only renders when `showLDTriangle`, which is half of the old guard.
  //
  // Derived from the one measurement rather than stored beside it, so the
  // tooltip, the crosshairs and the view's vertical guides all describe the
  // same cell in the same frame.
  const mouseState = useMouseState(mouseTracker)
  // isLoadingOrCanceled, not isLoading: a standing user cancel parks the
  // "Loading canceled / Retry" overlay, and hit-testing under it would float a
  // tooltip over cells the overlay says are not there
  const hoveredItem =
    mouseState && !model.isLoadingOrCanceled
      ? model.hitTest(mouseState.x, mouseState.y)
      : undefined
  const view = model.view
  const {
    showLegend,
    // The metric and sign convention the loaded values ACTUALLY have, not the
    // ones asked for: a pre-computed file with no D' column downgrades a
    // 'dprime' request to r², and one that states magnitudes cannot honor a
    // signed request at all. The cells already follow the data (the ramp is
    // built from `rpcData`), so a label off the config would name a statistic
    // and a range that are not on screen.
    effectiveLdMetric,
    effectiveSignedLD,
    ldMethod,
    effectiveLineZoneHeight,
    canvasWidth: width,
    canvasHeight,
  } = model
  const containerHeight = canvasHeight + effectiveLineZoneHeight

  // Through the model, in the connector lines' frame (viewport pixels): the
  // guides, the ticks and the lines all describe the same two loci, so they
  // have to be measured the same way — an x measured off the first content
  // block alone lands short by the left gap, and puts a SNP from a later block
  // nowhere near itself.
  const genomicX1 = hoveredItem
    ? model.locusViewportX(hoveredItem.snp2.refName, hoveredItem.snp2.start)
    : undefined
  const genomicX2 = hoveredItem
    ? model.locusViewportX(hoveredItem.snp1.refName, hoveredItem.snp1.start)
    : undefined

  // The guides live on the *view*, so they have to be pushed from an effect —
  // and an autorun does its own reads, so a pan or a zoom moves them with no
  // new mousemove to re-run a dep array on. The deps are the hovered pair
  // itself (identities out of `rpcData`, stable while the cursor stays in one
  // cell), so the autorun is torn down when the hover moves, not every frame.
  // The reads inside are duplicated from the two above on purpose: the render
  // needs the numbers for `Crosshairs`, and an autorun that took them as
  // arguments would track nothing.
  const hoveredSnp1 = hoveredItem?.snp1
  const hoveredSnp2 = hoveredItem?.snp2
  useEffect(() => {
    const dispose = autorun(() => {
      const x1 = hoveredSnp2
        ? model.locusViewportX(hoveredSnp2.refName, hoveredSnp2.start)
        : undefined
      const x2 = hoveredSnp1
        ? model.locusViewportX(hoveredSnp1.refName, hoveredSnp1.start)
        : undefined
      view.setVolatileGuides(
        x1 !== undefined && x2 !== undefined && model.showVerticalGuides
          ? [{ xPos: x1 }, { xPos: x2 }]
          : [],
      )
    })
    return () => {
      dispose()
      view.setVolatileGuides([])
    }
  }, [hoveredSnp1, hoveredSnp2, model, view])

  return (
    <>
      <canvas
        data-testid="ld_canvas"
        ref={canvasRef}
        style={{
          width,
          height: canvasHeight,
          position: 'absolute',
          left: 0,
          top: effectiveLineZoneHeight,
          // on the canvas rather than on the chrome container, so the hovered
          // cell doesn't have to travel back up to a component whose re-render
          // costs the whole chrome. Same pixels either way: `hitTest` only
          // answers inside the triangle, which is inside this canvas.
          cursor: hoveredItem ? 'crosshair' : undefined,
        }}
      />

      {model.focalSnpIndex >= 0 ? (
        <FocalSnpHighlight model={model} height={containerHeight} />
      ) : null}

      {hoveredItem && genomicX1 !== undefined && genomicX2 !== undefined ? (
        <Crosshairs
          model={model}
          hoveredItem={hoveredItem}
          genomicX1={genomicX1}
          genomicX2={genomicX2}
          height={containerHeight}
        />
      ) : null}

      {hoveredItem && mouseState ? (
        <LDTooltip
          item={hoveredItem}
          x={mouseState.clientX}
          y={mouseState.clientY}
          ldMetric={effectiveLdMetric}
          ldMethod={ldMethod}
          signedLD={effectiveSignedLD}
        />
      ) : null}
      {showLegend ? (
        <LDColorLegend
          ldMetric={effectiveLdMetric}
          signedLD={effectiveSignedLD}
          idSuffix={model.id}
        />
      ) : null}
      <LDStatusBar model={model} />
      <LDColumnZone model={model} />
    </>
  )
})

// Fills the chrome, which owns the box in both branches.
function EmptyState() {
  const palette = usePalette()
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: palette.text.secondary,
      }}
    >
      Enable LD triangle in display settings to view data
    </div>
  )
}

// Thin outer: owns the chrome and the pointer measurement bound to its
// container. There is no inner positioning div — the chrome already IS the
// `position:relative` box its own overlays need (DisplayStatusChromeBase), so
// sizing it here rather than nesting a second identically-sized container is
// what lets `mouseState` be measured against the same element the canvas fills.
const LDDisplayComponent = observer(function LDDisplayComponent({
  model,
}: {
  model: SharedLDModel
}) {
  // The same box the backends size their backing store to (`renderState`), off
  // the model: a width or height derived a second time here is a stretched
  // matrix the moment the two derivations disagree.
  const {
    showLDTriangle,
    canvasWidth: width,
    canvasHeight,
    effectiveLineZoneHeight,
    isLoading,
  } = model
  const containerHeight = canvasHeight + effectiveLineZoneHeight

  return (
    <DisplayChrome
      model={model}
      factory={LDRenderer}
      testid="ld-display"
      style={
        showLDTriangle
          ? {
              width,
              height: containerHeight,
              overflow: 'hidden',
            }
          : { width, height: model.height }
      }
      onClick={event => {
        // Click a cell to pin its row SNP as focal (highlights that SNP's LD
        // with every other variant); click empty space to clear. Hit-tested
        // from the click itself, not from the hover a previous frame recorded —
        // the measurement is rAF-coalesced, so that one can be a frame stale.
        //
        // `currentTarget` is the chrome container, which is the box the canvas
        // fills and the box the tracker measures against — the same rect a ref
        // would give, without needing one.
        const rect = event.currentTarget.getBoundingClientRect()
        if (showLDTriangle && !isLoading) {
          const item = model.hitTest(
            event.clientX - rect.left,
            event.clientY - rect.top,
          )
          model.setFocalSnp(item?.snp1)
        }
      }}
    >
      {({ canvasRef, mouseTracker }) =>
        showLDTriangle ? (
          <LDCanvas
            model={model}
            canvasRef={canvasRef}
            mouseTracker={mouseTracker}
          />
        ) : (
          <EmptyState />
        )
      }
    </DisplayChrome>
  )
})

export default LDDisplayComponent
