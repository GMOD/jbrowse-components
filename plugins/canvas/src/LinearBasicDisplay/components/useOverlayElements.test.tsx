import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../../RenderFeatureDataRPC/testUtils.ts'
import { useFloatingLabels } from './useOverlayElements.tsx'

import type { FeatureItemEntry, VisibleRegion } from './hitTesting.ts'

const VR: VisibleRegion = {
  refName: 'ctgA',
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  assemblyName: 'volvox',
  screenStartPx: 0,
  screenEndPx: 1000,
}

const ITEM = makeFlatbushItem({ featureId: 'f1', startBp: 100, endBp: 200 })

const DATA = makeFeatureData({
  floatingLabelsData: {
    f1: {
      featureId: 'f1',
      minX: 100,
      maxX: 200,
      topY: 0,
      featureHeight: 10,
      nameLabel: { text: 'NAME', relativeY: 4, color: 'black', textWidth: 30 },
    },
  },
})

const MODEL = {
  renderedShowLabels: true,
  renderedShowDescriptions: false,
  labelFontSize: 11,
  height: 100,
  labelScrollBucket: 0,
  selectedFeatureId: undefined,
  selectFeatureById: () => {},
}

function Harness({
  onLabelMouseOver,
  onLabelMouseLeave,
}: {
  onLabelMouseOver: () => void
  onLabelMouseLeave: () => void
}) {
  const featureItemMap = new Map<string, FeatureItemEntry>([
    ['f1', { kind: 'feature', item: ITEM, vr: VR, data: DATA }],
  ])
  return useFloatingLabels(
    new Map([[0, DATA]]),
    featureItemMap,
    [VR],
    true,
    1000,
    1,
    MODEL,
    () => {},
    onLabelMouseOver,
    onLabelMouseLeave,
  )
}

// The label layer is the only hover source other than the canvas, and it is
// stacked above it: entering a label fires the canvas's mouseleave, so once the
// label owns the hover, only the layer can drop it again. Leaving a label for
// anywhere that isn't the canvas (off the track edge, an adjacent track, out of
// the window) previously left the hover shading and tooltip stuck on.
test('label layer clears hover when the cursor leaves a label', () => {
  const onLabelMouseOver = jest.fn()
  const onLabelMouseLeave = jest.fn()
  const { getByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Harness
        onLabelMouseOver={onLabelMouseOver}
        onLabelMouseLeave={onLabelMouseLeave}
      />
    </ThemeProvider>,
  )

  const label = getByTestId('feature-name-NAME')
  fireEvent.mouseMove(label)
  expect(onLabelMouseOver).toHaveBeenCalledTimes(1)
  expect(onLabelMouseLeave).not.toHaveBeenCalled()

  // What the browser dispatches when the cursor exits the label to something
  // outside the layer entirely — React synthesizes the layer's onMouseLeave
  // from this, since the label is the layer's descendant and the new target
  // is not.
  fireEvent.mouseOut(label, { relatedTarget: document.body })
  expect(onLabelMouseLeave).toHaveBeenCalledTimes(1)
})
