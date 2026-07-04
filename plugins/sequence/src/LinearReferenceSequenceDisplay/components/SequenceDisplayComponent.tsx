import { useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { Alert } from '@mui/material'
import { observer } from 'mobx-react'

import { SequenceRenderer } from './Canvas2DSequenceRenderer.ts'

import type { SequenceHover } from './sequenceHover.ts'
import type { LinearReferenceSequenceDisplayModel } from '../model.ts'

const SequenceBody = observer(function SequenceBody({
  model,
  canvasRef,
}: {
  model: LinearReferenceSequenceDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  return model.zoomedOut ? (
    <Alert severity="info">Zoom in to see sequence</Alert>
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
  const { height } = model
  const containerRef = useRef<HTMLDivElement>(null)
  const [clientCoord, setClientCoord] = useState<[number, number]>()
  const [hover, setHover] = useState<SequenceHover>()

  function handleMouseMove(event: React.MouseEvent) {
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const info = model.hoverAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
      )
      setHover(info)
      setClientCoord(info ? [event.clientX, event.clientY] : undefined)
    }
  }

  function handleMouseLeave() {
    setHover(undefined)
    setClientCoord(undefined)
  }

  return (
    <>
      <DisplayChrome
        ref={containerRef}
        model={model}
        factory={SequenceRenderer}
        testid="sequence-display"
        style={{ width: '100%', height }}
        onMouseMove={event => { handleMouseMove(event) }}
        onMouseLeave={() => { handleMouseLeave() }}
      >
        {({ canvasRef }) => <SequenceBody model={model} canvasRef={canvasRef} />}
      </DisplayChrome>
      {hover && clientCoord ? (
        <BaseTooltip
          clientPoint={{ x: clientCoord[0] + 15, y: clientCoord[1] }}
        >
          <HoverContents hover={hover} />
        </BaseTooltip>
      ) : null}
    </>
  )
})

export default SequenceDisplayComponent
