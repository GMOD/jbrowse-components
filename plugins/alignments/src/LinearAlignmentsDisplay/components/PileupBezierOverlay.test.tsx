import { cleanup, fireEvent, render } from '@testing-library/react'

import PileupBezierOverlay from './PileupBezierOverlay.tsx'

import type { PileupArc } from '../../features/linkedReads/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { ReadHit } from '../readLookup.ts'

const mockView = { initialized: true, width: 800 }
let mockArcs: PileupArc[] = []

// The barrel is stubbed rather than spread, as the SVG-export tests stub it:
// requiring the real one pulls the whole config layer in behind
// `getContainingView`, which is the only member this component reaches for.
jest.mock('@jbrowse/core/util', () => ({
  getContainingView: () => mockView,
}))

// The geometry pass is the SVG export's too and has its own tests; what is
// asserted here is what the overlay does with the arcs it is handed.
jest.mock('./pileupBezierArcs.ts', () => ({
  BEZIER_ARC_STROKE_WIDTH: 1,
  BEZIER_ARC_STROKE_OPACITY: 0.8,
  computePileupBezierArcsFromModel: () => mockArcs,
}))

afterEach(cleanup)

const ARC: PileupArc = {
  d: 'M 0 0 C 10 10 20 10 30 0',
  stroke: 'red',
  id1: 'readA',
  id2: 'readB',
  label: 'Deletion',
}

const HIT = {
  displayedRegionIndex: 0,
  groupKey: '',
  idx: 7,
  rpcData: { chain: 'data' },
  start: 100,
  end: 200,
} as unknown as ReadHit

function renderOverlay(overrides: Partial<LinearAlignmentsDisplayModel> = {}) {
  mockArcs = [ARC]
  const model = {
    view: mockView,
    bezierArcScope: 'all',
    scrollTop: 0,
    height: 200,
    isChainMode: false,
    getFeatureInfoById: () => undefined,
    setHoverState: jest.fn(),
    clearMouseoverState: jest.fn(),
    selectFeatureById: jest.fn(),
    findFeatureInRpcData: jest.fn(() => HIT),
    readIdsSharingChain: jest.fn(() => ['readA', 'readB', 'readC']),
    setSelectedChainReadIds: jest.fn(),
    ...overrides,
  } as unknown as LinearAlignmentsDisplayModel
  const { container } = render(<PileupBezierOverlay model={model} />)
  return {
    model,
    target: container.querySelector<SVGPathElement>(
      '[data-testid="pileup-bezier-arc-target"]',
    )!,
  }
}

// A curve names a chain, not one of its ends. The canvas click on any read of
// that chain marks the whole of it (`useAlignmentsBase`'s handleClick), so a
// click on the connector between two of them has to land in the same place.
test('a click in chain mode selects the whole chain the curve belongs to', () => {
  const { model, target } = renderOverlay({ isChainMode: true })

  fireEvent.click(target)

  expect(model.selectFeatureById).toHaveBeenCalledWith('readA')
  expect(model.findFeatureInRpcData).toHaveBeenCalledWith('readA')
  expect(model.readIdsSharingChain).toHaveBeenCalledWith(HIT.rpcData, HIT.idx)
  expect(model.setSelectedChainReadIds).toHaveBeenCalledWith([
    'readA',
    'readB',
    'readC',
  ])
})

// Outside chain mode there is no chain to mark, and writing an empty list would
// clear a selection the click never made.
test('a click outside chain mode selects the read alone', () => {
  const { model, target } = renderOverlay()

  fireEvent.click(target)

  expect(model.selectFeatureById).toHaveBeenCalledWith('readA')
  expect(model.setSelectedChainReadIds).not.toHaveBeenCalled()
})

// The id resolves through a fetch that may since have been replaced, and an
// empty chain list is not the answer to that.
test('a click on a curve whose read is no longer loaded marks no chain', () => {
  const { model, target } = renderOverlay({
    isChainMode: true,
    findFeatureInRpcData: jest.fn(() => undefined),
  })

  fireEvent.click(target)

  expect(model.setSelectedChainReadIds).not.toHaveBeenCalled()
})

// Through `setHoverState`, which the open context menu's hover pin can refuse —
// the direct volatile write it replaces could not be.
test('hovering a curve writes the tooltip through the pinnable hover action', () => {
  const { model, target } = renderOverlay()

  fireEvent.mouseEnter(target)

  expect(model.setHoverState).toHaveBeenCalledWith({
    overCigarItem: false,
    featureIdUnderMouse: undefined,
    mouseoverExtraInformation: 'Deletion',
    highlightedChainReadIds: [],
  })
})
