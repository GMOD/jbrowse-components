import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import {
  labelsMap,
  makeFeatureData,
  makeFlatbushItem,
} from '../../RenderFeatureDataRPC/testUtils.ts'
import { FloatingLabelsLayer, HighlightLayer } from './overlayElements.tsx'

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
  // matches the view slice's `trackWidthPx` below, since the real getter is
  // `lgv.trackWidthPx` — the two are one number, read from the model
  canvasWidthPx: 1000,
  labelFontSize: 11,
  height: 100,
  contentHeight: 100,
  labelScrollBucket: 0,
  featureItemMap: new Map<string, FeatureItemEntry>([
    ['f1', { kind: 'feature', item: ITEM, vr: VR, data: DATA }],
  ]),
  renderDataMap: new Map([[0, DATA]]),
  openContextMenu: () => {},
  selectFeatureById: () => {},
  toggleSoloFeature: () => {},
  toggleExpandedGene: () => {},
}

// Only the geometry the layer reads; the layer takes the real LGV type, and the
// unit test drives it with this slice rather than instantiating a view.
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

// A label sits on top of its own glyph, so the two entry points must read the
// same gesture the same way — collecting a run of features with ctrl+click used
// to open a details widget the moment the cursor caught a name.
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

// A gene carrying a transcript name under it (`subfeatureLabels: 'below'`), and
// no name or description of its own — so the only thing the layer can emit is
// the subfeature label, and its presence in the DOM is the whole assertion.
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

// The overlap this pins is the one 1,200 model-level tests could not see: the
// model decides WHETHER a label shows, and only the layer decides whether one
// lands in the DOM. A subfeature label is worker-baked, so the fit ladder's two
// feature-label flags don't touch it — it survives the `bodies` rung, where the
// packer reserved its row. What it must not survive is the SQUEEZE, which scales
// that row while the text keeps its font size, painting a gene's transcript names
// over each other.
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

// The slice HighlightLayer reads, with one feature (`f1`) search-highlighted.
const HIGHLIGHT_MODEL = {
  renderedShowLabels: true,
  renderedShowSubfeatureLabels: true,
  renderedShowDescriptions: false,
  canvasWidthPx: 1000,
  labelFontSize: 11,
  selectedFeatureId: undefined,
  hoverBoxFeature: null,
  hoverBoxSubfeature: null,
  featureItemMap: MODEL.featureItemMap,
  morphOffsetFor: () => 0,
  highlightedFeatureIdSet: new Set(['f1']),
  soloFeatureIdSet: new Set<string>(),
  soloApplied: false,
}

// A box is drawn once per visible region on the feature's own reference
// sequence, which is how a feature spanning a displayed-region boundary gets
// boxed piecewise. "Same sequence" is assembly + refName (the layout's own
// `regionKey`), so a same-named region of a different assembly is not it.
//
// Pins the rule rather than a reachable symptom: JBrowse doesn't display two
// assemblies on one LGV row today. Here so the overlay's region matching can't
// quietly drift back to refName alone.
test('highlight boxes are scoped to the reference sequence, not the refName', () => {
  const otherAssembly: VisibleRegion = {
    ...VR,
    assemblyName: 'volvox2',
    displayedRegionIndex: 1,
  }
  const view = {
    initialized: true,
    trackWidthPx: 1000,
    bpPerPx: 1,
    visibleRegions: [VR, otherAssembly],
  } as unknown as LinearGenomeViewModel

  const { getAllByTestId } = render(
    <HighlightLayer model={HIGHLIGHT_MODEL} view={view} />,
  )
  expect(getAllByTestId('feature-highlight')).toHaveLength(1)
})

// A box frames a glyph, so it has to travel with one. Its geometry comes from
// `featureItemMap`, which holds the SETTLED rows so hit targets are the
// destination — mid Y-morph the glyph itself is drawn `morphOffsetFor` px off
// that row, and without applying it the box snaps to the destination and waits
// there for the morph's 300ms while the feature is still on its way.
test('a highlight box follows its feature through a Y morph', () => {
  const at = (morphOffsetFor: () => number) => {
    const { getByTestId, unmount } = render(
      <HighlightLayer
        model={{ ...HIGHLIGHT_MODEL, morphOffsetFor }}
        view={VIEW}
      />,
    )
    const { top } = getByTestId('feature-highlight').style
    unmount()
    return top
  }

  // the feature is laid out at topPx 0, and the box is outset 2px above it —
  // clamped to the content edge when it has nowhere to go
  expect(at(() => 0)).toBe('0px')
  // eased 25px down from its row: 25 - 2 of outset, no clamping needed
  expect(at(() => 25)).toBe('23px')
})
