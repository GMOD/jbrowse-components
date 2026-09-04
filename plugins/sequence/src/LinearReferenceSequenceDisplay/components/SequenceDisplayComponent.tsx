import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { toLocale } from '@jbrowse/core/util'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { PointerLayer } from '@jbrowse/display-ui'
import { Alert } from '@mui/material'
import { observer } from 'mobx-react'

import { SequenceRenderer } from './Canvas2DSequenceRenderer.ts'

import type { LinearReferenceSequenceDisplayModel } from '../model.ts'
import type { SequenceHover } from './sequenceHover.ts'

const SequenceBody = observer(function SequenceBody({
  model,
  canvasRef,
}: {
  model: LinearReferenceSequenceDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  const { placeholderMessage } = model
  return placeholderMessage ? (
    <Alert severity="info">{placeholderMessage}</Alert>
  ) : (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
})

function frameLabel(frame: number) {
  return frame > 0 ? `+${frame}` : `${frame}`
}

// Not an observer: `hover` is a plain resolved object, so there is nothing here
// to track — SequenceHoverTooltip did the reading.
function HoverContents({ hover }: { hover: SequenceHover }) {
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
}

const SequenceDisplayComponent = observer(function SequenceDisplayComponent({
  model,
}: {
  model: LinearReferenceSequenceDisplayModel
}) {
  const { height } = model
  return (
    <DisplayChrome
      model={model}
      factory={SequenceRenderer}
      testid="sequence-display"
      style={{ width: '100%', height }}
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
