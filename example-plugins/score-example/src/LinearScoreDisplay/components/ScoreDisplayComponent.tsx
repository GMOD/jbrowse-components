// #exampleFile shared | React: DisplayChrome wrapping the canvas; builds the backend from the mark list
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { observer } from 'mobx-react'

import { findScoreHit } from '../findScoreHit.ts'
import { SCORE_MARKS } from '../scoreMarks.ts'

import type { LinearScoreDisplayModel } from '../model.ts'

// #region factory
// The only import on the mark path that reaches the HAL. It lives here, on the
// lazily loaded component, and not in the model: a state model is eager, so
// naming the backend there would load the GPU stack at plugin install.
// createMarkBackend tries WebGPU, then WebGL2, then Canvas2D, and every backend
// walks the same mark list.
function createScoreBackend(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, SCORE_MARKS)
}
// #endregion

// DisplayChrome supplies the display's chrome (loading scrim, error bar,
// region-too-large banner) and WebGL/WebGPU context-loss recovery, and is the
// only place useRenderingBackend is called. Its render-prop hands back the
// canvasRef to attach to the <canvas>.
const ScoreDisplayComponent = observer(function ScoreDisplayComponent({
  model,
}: {
  model: LinearScoreDisplayModel
}) {
  const { hoveredFeature } = model
  return (
    <DisplayChrome
      model={model}
      factory={createScoreBackend}
      testid="score-display"
      style={{ width: '100%', height: model.height }}
      // #region hover
      // measured against the chrome container, which the canvas fills, so the
      // pointer lands in canvas px with no offset
      onPointerPosition={state => {
        model.setHoveredFeature(
          state
            ? findScoreHit(
                state.x,
                state.y,
                model.renderBlocks,
                model.rpcDataMap,
                model.renderState,
              )
            : undefined,
        )
      }}
      // #endregion
    >
      {({ canvasRef }) => (
        <>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
          {hoveredFeature ? (
            <div
              style={{
                position: 'absolute',
                left: hoveredFeature.x + 6,
                top: hoveredFeature.y - 6,
                pointerEvents: 'none',
                fontSize: 11,
                background: 'rgba(255,255,255,0.85)',
                padding: '0 3px',
              }}
            >
              {hoveredFeature.score.toFixed(2)}
            </div>
          ) : null}
        </>
      )}
    </DisplayChrome>
  )
})

export default ScoreDisplayComponent
