import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import {
  labelsMap,
  makeFeatureData,
  makeFlatbushItem,
} from '../../RenderFeatureDataRPC/testUtils.ts'
import { isCanvasWithId } from './hoverLeave.ts'
import { hgvsHitLabel, hoverTooltipText } from './hoverReadout.ts'
import { FloatingLabelsLayer } from './overlayElements.tsx'

import type { FeatureContextMenuInfo } from '../featureContextMenu.ts'
import type { HitFeatureResult, VisibleRegion } from './hitTesting.ts'
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
      nameLabel: { text: 'NAME', textWidth: 30 },
    },
  }),
})

const LABELS = {
  showLabels: true,
  showSubfeatureLabels: true,
  showDescriptions: false,
  fontSize: 11,
}

const MODEL = {
  renderedLabels: LABELS,
  canvasWidthPx: 1000,
  height: 100,
  contentHeight: 100,
  labelScrollBucket: 0,
  featureIdIndex: new Map([['f1', ITEM]]),
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
  onLabelMouseLeave: (relatedTarget: EventTarget | null) => void
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

describe('leaving a name for the display canvas', () => {
  function renderBesideCanvas() {
    const clearHover = jest.fn()
    const utils = render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <canvas id="mine" data-testid="mine" />
        <canvas id="theirs" data-testid="theirs" />
        <FloatingLabelsLayer
          model={MODEL}
          view={VIEW}
          onLabelMouseLeave={relatedTarget => {
            if (!isCanvasWithId(relatedTarget, 'mine')) {
              clearHover()
            }
          }}
        />
      </ThemeProvider>,
    )
    return { clearHover, ...utils }
  }

  it('keeps the hover for the canvas handler to replace', () => {
    const { clearHover, getByTestId } = renderBesideCanvas()
    fireEvent.mouseOut(getByTestId('feature-name-NAME'), {
      relatedTarget: getByTestId('mine'),
    })
    expect(clearHover).not.toHaveBeenCalled()
  })

  it('clears the hover when another track canvas is entered', () => {
    const { clearHover, getByTestId } = renderBesideCanvas()
    fireEvent.mouseOut(getByTestId('feature-name-NAME'), {
      relatedTarget: getByTestId('theirs'),
    })
    expect(clearHover).toHaveBeenCalledTimes(1)
  })

  it('clears the hover when leaving the window', () => {
    const { clearHover, getByTestId } = renderBesideCanvas()
    fireEvent.mouseOut(getByTestId('feature-name-NAME'), {
      relatedTarget: document.body,
    })
    expect(clearHover).toHaveBeenCalledTimes(1)
  })
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
    renderedLabels: { ...LABELS, showLabels: false, showDescriptions: false },
  })
  expect(queryByText('TX1')).not.toBeNull()
})

test('the label layer drops a subfeature label the fit squeeze has shrunk', () => {
  const { queryByText } = renderLabels({
    renderedLabels: {
      ...LABELS,
      showLabels: false,
      showDescriptions: false,
      showSubfeatureLabels: false,
    },
  })
  expect(queryByText('TX1')).toBeNull()
})

const TRANSCRIPT_ITEM = makeFlatbushItem({
  featureId: 'f1',
  startBp: 100,
  endBp: 200,
  name: 'TX-1',
  tooltip: 'TX-1',
  transcript: { exons: [100, 140, 160, 200], strand: 1, coding: [110, 190] },
})

function renderTranscriptLayer(overrides: {
  openContextMenu?: (info: FeatureContextMenuInfo) => void
  onLabelMouseOver?: (hit: HitFeatureResult) => void
}) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FloatingLabelsLayer
        model={{
          ...MODEL,
          featureIdIndex: new Map([['f1', TRANSCRIPT_ITEM]]),
          openContextMenu: overrides.openContextMenu ?? (() => {}),
        }}
        view={VIEW}
        onLabelMouseOver={overrides.onLabelMouseOver}
      />
    </ThemeProvider>,
  )
}

test('right-clicking a name offers the HGVS position that hovering the same point shows', () => {
  const openContextMenu = jest.fn<void, [FeatureContextMenuInfo]>()
  const onLabelMouseOver = jest.fn<void, [HitFeatureResult]>()
  const { getByTestId } = renderTranscriptLayer({
    openContextMenu,
    onLabelMouseOver,
  })
  const label = getByTestId('feature-name-NAME')
  const point = { clientX: 120, clientY: 5 }

  fireEvent.mouseMove(label, point)
  fireEvent.contextMenu(label, point)

  const [hovered] = onLabelMouseOver.mock.calls[0]!
  const [info] = openContextMenu.mock.calls[0]!
  expect(hgvsHitLabel(hovered)).toMatch(/^TX-1:c\.\d+$/)
  expect(info.hgvsLabel).toBe(hgvsHitLabel(hovered))
  expect(info.tooltipText).toBe(hoverTooltipText(hovered))
})
