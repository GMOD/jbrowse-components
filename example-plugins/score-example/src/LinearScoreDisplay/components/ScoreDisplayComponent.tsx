import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { ScoreRenderer } from './ScoreRendererFactory.ts'

import type { LinearScoreDisplayModel } from '../model.ts'

// DisplayChrome supplies the display's chrome (loading scrim, error bar,
// region-too-large banner) and WebGL/WebGPU context-loss recovery, and is the
// only place useRenderingBackend is called. Its render-prop hands back the
// canvasRef to attach to the <canvas>.
const ScoreDisplayComponent = observer(function ScoreDisplayComponent({
  model,
}: {
  model: LinearScoreDisplayModel
}) {
  return (
    <DisplayChrome
      model={model}
      factory={ScoreRenderer}
      testid="score-display"
      style={{ width: '100%', height: model.height }}
    >
      {({ canvasRef }) => (
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      )}
    </DisplayChrome>
  )
})

export default ScoreDisplayComponent
