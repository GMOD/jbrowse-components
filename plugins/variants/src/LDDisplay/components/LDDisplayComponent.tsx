import { useEffect, useRef } from 'react'

import { useMouseState, useMouseTracking } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import RecombinationTrack from '../../shared/components/RecombinationTrack.tsx'
import RecombinationYScaleBar from '../../shared/components/RecombinationYScaleBar.tsx'
import Crosshairs from './Crosshairs.tsx'
import FocalSnpHighlight from './FocalSnpHighlight.tsx'
import LDColorLegend from './LDColorLegend.tsx'
import LDLabelZone from './LDLabelZone.tsx'
import { LDRenderer } from './LDRenderer.ts'
import LDStatusBar from './LDStatusBar.tsx'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'

import type { LDFlatbushItem } from '../../RenderLDDataRPC/types.ts'
import type { SharedLDModel } from '../shared.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function SnpRow({ snp }: { snp: LDFlatbushItem['snp1'] }) {
  return (
    <div>
      {snp.id ? <b>{snp.id} </b> : null}
      {snp.refName}:{(snp.start + 1).toLocaleString()}
      {snp.maf === undefined ? null : ` · MAF ${snp.maf.toFixed(3)}`}
    </div>
  )
}

function LDTooltip({
  item,
  x,
  y,
  ldMetric,
  signedLD,
}: {
  item: LDFlatbushItem
  x: number
  y: number
  ldMetric: string
  signedLD: boolean
}) {
  let metricLabel: string
  if (ldMetric === 'dprime') {
    metricLabel = "D'"
  } else {
    metricLabel = signedLD ? 'R' : 'R²'
  }
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
    <BaseTooltip clientPoint={{ x: x + 15, y }}>
      <SnpRow snp={item.snp1} />
      <SnpRow snp={item.snp2} />
      <div>
        {metricLabel}: {item.ldValue.toFixed(3)}
        {phase}
      </div>
      <div>Distance: {getBpDisplayStr(distance)}</div>
    </BaseTooltip>
  )
}

const RecombinationOverlay = observer(function RecombinationOverlay({
  model,
  width,
  recombHeight,
  top,
}: {
  model: SharedLDModel
  width: number
  recombHeight: number
  top: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top,
        width,
        height: recombHeight,
        pointerEvents: 'none',
      }}
    >
      <RecombinationTrack
        points={model.recombinationCoords}
        maxValue={model.recombinationMax}
        width={width}
        height={recombHeight}
      />
      <RecombinationYScaleBar
        height={recombHeight}
        maxValue={model.recombinationMax}
      />
    </div>
  )
})

const LDCanvas = observer(function LDCanvas({
  model,
  canvasRef,
  mouseTracker,
  width,
  canvasOnlyHeight,
  containerHeight,
}: {
  model: SharedLDModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  mouseTracker: MouseTracker
  width: number
  canvasOnlyHeight: number
  containerHeight: number
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
  const hoveredItem =
    mouseState && !model.isLoading
      ? model.hitTest(mouseState.x, mouseState.y)
      : undefined
  const view = getContainingView(model) as LGV
  const {
    showLegend,
    // the metric the loaded values ACTUALLY are, not the one asked for. A
    // pre-computed file with no D' column downgrades a 'dprime' request to r²,
    // and the cell ramp already follows the data (`d.metric`), so a label off
    // the config would name a statistic that is not on screen.
    effectiveLdMetric,
    lineZoneHeight,
    // the layout the loaded matrix actually has, not the one the slot asks for
    // — a multi-region viewport falls back to uniform cells in the worker
    effectiveUseGenomicPositions,
    signedLD,
    effectiveLineZoneHeight,
  } = model

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
          height: canvasOnlyHeight,
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
          signedLD={signedLD}
        />
      ) : null}
      {showLegend ? (
        <LDColorLegend
          ldMetric={effectiveLdMetric}
          signedLD={signedLD}
          idSuffix={model.id}
        />
      ) : null}
      <LDStatusBar model={model} />
      {effectiveUseGenomicPositions ? (
        <LDLabelZone model={model} />
      ) : (
        <LinesConnectingMatrixToGenomicPosition model={model} />
      )}
      {model.showRecombination && model.recombination ? (
        <RecombinationOverlay
          model={model}
          width={width}
          recombHeight={
            effectiveUseGenomicPositions
              ? effectiveLineZoneHeight
              : lineZoneHeight / 2
          }
          top={effectiveUseGenomicPositions ? 0 : lineZoneHeight / 2}
        />
      ) : null}
    </>
  )
})

// Fills the chrome, which owns the box in both branches.
function EmptyState() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
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
  const view = getContainingView(model) as LGV
  const width = view.totalWidthPxWithoutBorders
  const {
    showLDTriangle,
    squashToHeight,
    ldCanvasHeight,
    effectiveLineZoneHeight,
    isLoading,
  } = model

  const canvasOnlyHeight = squashToHeight ? ldCanvasHeight : width / 2
  const containerHeight = canvasOnlyHeight + effectiveLineZoneHeight

  const ref = useRef<HTMLDivElement>(null)
  const { mouseTracker, handleMouseMove, handleMouseLeave } =
    useMouseTracking(ref)

  return (
    <DisplayChrome
      model={model}
      factory={LDRenderer}
      ref={ref}
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
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={event => {
        // Click a cell to pin its row SNP as focal (highlights that SNP's LD
        // with every other variant); click empty space to clear. Hit-tested
        // from the click itself, not from the hover a previous frame recorded —
        // the measurement is rAF-coalesced, so that one can be a frame stale.
        const rect = ref.current?.getBoundingClientRect()
        if (rect && showLDTriangle && !isLoading) {
          const item = model.hitTest(
            event.clientX - rect.left,
            event.clientY - rect.top,
          )
          model.setFocalSnp(item?.snp1)
        }
      }}
    >
      {({ canvasRef }) =>
        showLDTriangle ? (
          <LDCanvas
            model={model}
            canvasRef={canvasRef}
            mouseTracker={mouseTracker}
            width={width}
            canvasOnlyHeight={canvasOnlyHeight}
            containerHeight={containerHeight}
          />
        ) : (
          <EmptyState />
        )
      }
    </DisplayChrome>
  )
})

export default LDDisplayComponent
