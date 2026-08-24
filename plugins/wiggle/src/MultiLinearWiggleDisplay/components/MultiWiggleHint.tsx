import BlockMsg from '@jbrowse/display-kit/BlockMsg'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

// What the hint reads, spelled out like its sibling overlays (see
// MultiWiggleOverlayLines, MultiWiggleSvgScales) rather than taking the whole
// display — which is also what keeps the two blank-plot cases checkable without
// standing one up.
export interface HintModel {
  numSources: number
  isOverlay: boolean
  isDensityMode: boolean
  effectiveRowHeight: number
  height: number
  sourcesWithoutLayout: { name: string }[]
  subtreeFilter?: readonly string[]
  setSubtreeFilter: (names?: string[]) => void
}

// The plot would otherwise render as a silent blank in two recoverable cases;
// name the escape inline instead of leaving the user staring at nothing. Each
// case carries its own escape hatch: clearing the filter is the fix for the
// first and would make the second (too many rows) strictly worse.
function hint(model: HintModel) {
  const { numSources, isOverlay, isDensityMode, effectiveRowHeight } = model
  // A subtree filter that matches nothing: loaded adapter sources exist but the
  // filter removed them all (numSources is the post-filter count). Otherwise,
  // multi-row mode packed so tight rows are sub-pixel — the canvas draws, but
  // as an unreadable smear.
  //
  // Not in density mode: there the escape the message names IS the mode the
  // user is already in, and sub-pixel rows are the intended cohort view (a
  // thousand-sample heatmap is read as a stack, not row by row), so the hint
  // was advice that could not be taken sitting over the figure it described.
  return model.sourcesWithoutLayout.length > 0 && numSources === 0
    ? {
        message: 'No subtracks match the current subtree filter',
        clearFilter: true,
      }
    : !isOverlay && !isDensityMode && numSources > 0 && effectiveRowHeight < 1
      ? {
          message: `${numSources} subtracks in ${Math.round(model.height)}px leaves rows below 1px. Switch to an overlay or density rendering, or increase the track height.`,
          clearFilter: false,
        }
      : undefined
}

const MultiWiggleHint = observer(function MultiWiggleHint({
  model,
}: {
  model: HintModel
}) {
  const shown = hint(model)
  return shown ? (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1,
      }}
    >
      <BlockMsg
        severity="warning"
        message={shown.message}
        action={
          shown.clearFilter && model.subtreeFilter?.length ? (
            <Button
              onClick={() => {
                model.setSubtreeFilter(undefined)
              }}
            >
              Clear subtree filter
            </Button>
          ) : undefined
        }
      />
    </div>
  ) : null
})

export default MultiWiggleHint
