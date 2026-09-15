import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import {
  labelsMap,
  makeFeatureData,
  makeFlatbushItem,
} from '../../RenderFeatureDataRPC/testUtils.ts'
import { FloatingLabelsLayer } from './overlayElements.tsx'

import type { FeatureItemEntry, VisibleRegion } from './hitTesting.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  floatingLabelsData: labelsMap({
    f1: {
      featureId: 'f1',
      minX: 100,
      maxX: 200,
      topY: 0,
      featureHeight: 10,
      nameLabel: { text: 'NAME', relativeY: 4, textWidth: 30 },
    },
  }),
})

const MODEL = {
  renderedShowLabels: true,
  renderedShowSubfeatureLabels: true,
  renderedShowDescriptions: false,
  canvasWidthPx: 1000,
  renderedLabelFontSize: 11,
  height: 100,
  contentHeight: 100,
  labelScrollBucket: 0,
  featureItemMap: new Map<string, FeatureItemEntry>([
    ['f1', { kind: 'feature', item: ITEM, source: VR }],
  ]),
  renderDataMap: new Map([[0, DATA]]),
  openContextMenu: () => {},
  selectFeatureById: () => {},
  toggleSoloFeature: () => {},
  toggleExpandedGene: () => {},
}

const VIEW = {
  initialized: true,
  trackWidthPx: 1000,
  bpPerPx: 1,
  visibleRegions: [VR],
} as unknown as LinearGenomeViewModel

function Harness({
  onLabelMouseOver,
  onLabelMouseLeave,
}: {
  onLabelMouseOver: () => void
  onLabelMouseLeave: () => void
}) {
  return (
    <FloatingLabelsLayer
      model={MODEL}
      view={VIEW}
      onLabelMouseOver={onLabelMouseOver}
      onLabelMouseLeave={onLabelMouseLeave}
    />
  )
}

// Entering a label fires the canvas's mouseleave, so once the label owns the
// hover only the layer can drop it again.
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

  // React synthesizes the layer's onMouseLeave from this, the label being its
  // descendant and the new target not.
  fireEvent.mouseOut(label, { relatedTarget: document.body })
  expect(onLabelMouseLeave).toHaveBeenCalledTimes(1)
})

// A label sits on top of its own glyph, so both entry points have to read the
// same gesture the same way.
test.each([
  ['plain', {}, 'select'],
  ['ctrl', { ctrlKey: true }, 'solo'],
  ['meta', { metaKey: true }, 'solo'],
])('%s click on a label routes to %s', (_name, modifier, expected) => {
  const selectFeatureById = jest.fn()
  const toggleSoloFeature = jest.fn()
  const { getByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FloatingLabelsLayer
        model={{ ...MODEL, selectFeatureById, toggleSoloFeature }}
        view={VIEW}
      />
    </ThemeProvider>,
  )

  fireEvent.click(getByTestId('feature-name-NAME'), modifier)
  expect(selectFeatureById.mock.calls.length ? 'select' : 'solo').toBe(expected)
  expect(toggleSoloFeature.mock.calls.length > 0).toBe(expected === 'solo')
})

// A gene with a transcript name under it and none of its own, so the subfeature
// label is the only thing the layer can emit.
const SUBFEATURE_LABEL_DATA = makeFeatureData({
  floatingLabelsData: labelsMap({
    f1: {
      featureId: 'f1',
      minX: 100,
      maxX: 200,
      topY: 0,
      featureHeight: 10,
      subfeatureLabel: {
        text: 'TX1',
        relativeY: 4,
        textWidth: 30,
        isOverlay: false,
      },
    },
  }),
})

function renderLabels(overrides: Partial<typeof MODEL>) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FloatingLabelsLayer
        model={{
          ...MODEL,
          renderDataMap: new Map([[0, SUBFEATURE_LABEL_DATA]]),
          ...overrides,
        }}
        view={VIEW}
      />
    </ThemeProvider>,
  )
}

// A subfeature label is worker-baked, so the fit ladder's two feature-label flags
// leave it alone. What it must not survive is the squeeze, which scales its row
// while the text keeps its font size.
test('the label layer keeps a subfeature label past the flags that hide names', () => {
  const { queryByText } = renderLabels({
    renderedShowLabels: false,
    renderedShowDescriptions: false,
  })
  expect(queryByText('TX1')).not.toBeNull()
})

test('the label layer drops a subfeature label the fit squeeze has shrunk', () => {
  const { queryByText } = renderLabels({
    renderedShowLabels: false,
    renderedShowDescriptions: false,
    renderedShowSubfeatureLabels: false,
  })
  expect(queryByText('TX1')).toBeNull()
})
