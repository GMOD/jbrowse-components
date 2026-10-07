import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { toLocale } from '@jbrowse/core/util'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { PointerLayer, TrackOverlayPortal } from '@jbrowse/display-ui'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { Alert } from '@mui/material'
import { observer } from 'mobx-react'

import { drawSequenceLetters } from './drawSequenceLetters.ts'
import { SEQUENCE_MARKS } from './sequenceMarks.ts'

import type { LinearReferenceSequenceDisplayModel } from '../model.ts'
import type { SequenceHover } from './sequenceHover.ts'

function createSequenceBackend(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, SEQUENCE_MARKS)
}

// #region letters
const SequenceLetters = observer(function SequenceLetters({
  model,
}: {
  model: LinearReferenceSequenceDisplayModel
}) {
  const { sequenceData, renderBlocks, renderState } = model
  return renderState.showLetters ? (
    <OverlayCanvas
      width={renderState.canvasWidth}
      height={renderState.canvasHeight}
      draw={ctx => {
        drawSequenceLetters(ctx, sequenceData, renderBlocks, renderState)
      }}
    />
  ) : null
})
// #endregion

const SequenceBody = observer(function SequenceBody({
  model,
  canvasRef,
}: {
  model: LinearReferenceSequenceDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  const { placeholderMessage, canvasWidthPx, height } = model
  return placeholderMessage ? (
    <TrackOverlayPortal>
      <Alert severity="info">{placeholderMessage}</Alert>
    </TrackOverlayPortal>
  ) : (
    <>
      <canvas
        ref={canvasRef}
        style={{ width: canvasWidthPx, height, display: 'block' }}
      />
      <SequenceLetters model={model} />
    </>
  )
})

function frameLabel(frame: number) {
  return frame > 0 ? `+${frame}` : `${frame}`
}

const HoverContents = observer(function HoverContents({
  hover,
}: {
  hover: SequenceHover
}) {
  const { refName, coord, detail } = hover
  return (
    <>
      <div>
        {refName}:{toLocale(coord)}
      </div>
      {detail?.type === 'base' ? (
        <div>
          {detail.strand === 1 ? '+' : '−'} strand: {detail.base}
        </div>
      ) : null}
      {detail?.type === 'codon' ? (
        <div>
          Frame {frameLabel(detail.frame)}: {detail.codon} → {detail.aminoAcid}
          {detail.kind === 'start'
            ? ' (start)'
            : detail.kind === 'stop'
              ? ' (stop)'
              : ''}
        </div>
      ) : null}
    </>
  )
})

const SequenceDisplayComponent = observer(function SequenceDisplayComponent({
  model,
}: {
  model: LinearReferenceSequenceDisplayModel
}) {
  return (
    <DisplayChrome
      model={model}
      factory={createSequenceBackend}
      testid="sequence-display"
      style={{ width: '100%' }}
    >
      {({ canvasRef, mouseTracker }) => (
        <>
          <SequenceBody model={model} canvasRef={canvasRef} />
          {/* `hoverAt` resolved in the layer, not a handler, so the readout
              under a stationary cursor re-reads when the sequence or the
              viewport moves */}
          <PointerLayer mouseTracker={mouseTracker}>
            {mouseState => {
              const hover = mouseState
                ? model.hoverAt(mouseState.x, mouseState.y)
                : undefined
              return (
                <HoverTooltip hit={hover} mouseState={mouseState}>
                  {hover ? <HoverContents hover={hover} /> : null}
                </HoverTooltip>
              )
            }}
          </PointerLayer>
        </>
      )}
    </DisplayChrome>
  )
})

export default SequenceDisplayComponent
