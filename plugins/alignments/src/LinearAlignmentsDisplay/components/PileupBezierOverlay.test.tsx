import { cleanup, fireEvent, render } from '@testing-library/react'

import PileupBezierOverlay from './PileupBezierOverlay.tsx'

import type { PileupArc } from '../../features/linkedReads/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'

const mockView = { initialized: true, width: 800 }
let mockArcs: PileupArc[] = []

// The barrel is stubbed rather than spread, as the SVG-export tests stub it:
// requiring the real one pulls the whole config layer in behind
// `getContainingView`, which is the only member this component reaches for.
jest.mock('@jbrowse/core/util', () => ({
  getContainingView: () => mockView,
}))

jest.mock('@jbrowse/sv-core', () => ({
  ARC_HIT_SLOP_PX: 3,
  hiddenSegmentsNote: (loci: string[]) => `hidden: ${loci.join(', ')}`,
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
  readName: 'read',
  x1: 0,
  x2: 30,
  label: 'Deletion',
}

// The second hop of the same read, and one arc of another read.
const NEXT_HOP: PileupArc = {
  ...ARC,
  d: 'M 30 0 C 40 10 50 10 60 0',
  id1: 'readB',
  id2: 'readC',
  x1: 30,
  x2: 60,
}
const OTHER: PileupArc = {
  ...ARC,
  d: 'M 100 0 C 110 10 120 10 130 0',
  id1: 'otherA',
  id2: 'otherB',
  readName: 'other',
  x1: 100,
  x2: 130,
}

const CHAIN = ['readA', 'readB', 'readC']

function renderOverlay(
  overrides: Partial<LinearAlignmentsDisplayModel> = {},
  arcs: PileupArc[] = [ARC],
) {
  mockArcs = arcs
  const model = {
    view: mockView,
    bezierArcScope: 'all',
    scrollTop: 0,
    height: 200,
    isChainMode: false,
    selectedFeatureId: undefined,
    selectedChainReadIds: [],
    getFeatureInfoById: () => undefined,
    setHoverState: jest.fn(),
    clearMouseoverState: jest.fn(),
    readIdsSharingChainWith: jest.fn(() => []),
    selectReadWithChain: jest.fn(),
    ...overrides,
  } as unknown as LinearAlignmentsDisplayModel
  const { container } = render(<PileupBezierOverlay model={model} />)
  const targets = [
    ...container.querySelectorAll<SVGPathElement>(
      '[data-testid="pileup-bezier-arc-target"]',
    ),
  ]
  const inks = [
    ...container.querySelectorAll<SVGPathElement>(
      '[data-testid="pileup-bezier-arc"]',
    ),
  ]
  return { model, target: targets[0]!, targets, inks }
}

const strokeWidth = (path: SVGPathElement) =>
  Number(path.getAttribute('stroke-width'))
const inkFor = (inks: SVGPathElement[], arc: PileupArc) =>
  inks.find(p => p.getAttribute('d') === arc.d)!

// A curve names a chain, not one of its ends. The canvas click on any read of
// that chain marks the whole of it, so a click on the connector between two of
// them has to land in the same place — through the one model action both use.
test('a click selects the endpoint nearer the cursor, chain and all', () => {
  const { model, target } = renderOverlay()

  fireEvent.click(target, { clientX: 25 })
  expect(model.selectReadWithChain).toHaveBeenCalledWith('readB')

  fireEvent.click(target, { clientX: 5 })
  expect(model.selectReadWithChain).toHaveBeenLastCalledWith('readA')
})

// Through `setHoverState`, which the open context menu's hover pin can refuse —
// the direct volatile write it replaces could not be. Outside chain mode the
// connector's two ends are what a canvas hover on either would box.
test('hovering a curve boxes both of its reads outside chain mode', () => {
  const { model, target } = renderOverlay()

  fireEvent.mouseEnter(target)

  expect(model.setHoverState).toHaveBeenCalledWith({
    overCigarItem: false,
    featureIdUnderMouse: undefined,
    mouseoverExtraInformation: 'Deletion',
    highlightedChainReadIds: ['readA', 'readB'],
  })
})

// In chain mode the hover boxes every segment of the read, as hovering one of
// those segments on the canvas does, and as the breakpoint split view does for
// a junction.
test('hovering a curve in chain mode boxes the whole chain', () => {
  const { model, target } = renderOverlay({
    isChainMode: true,
    readIdsSharingChainWith: jest.fn(() => CHAIN),
  })

  fireEvent.mouseEnter(target)

  expect(model.readIdsSharingChainWith).toHaveBeenCalledWith('readA')
  expect(model.setHoverState).toHaveBeenCalledWith(
    expect.objectContaining({ highlightedChainReadIds: CHAIN }),
  )
})

// A three-segment read is two arcs. Hovering either is asking about the read,
// so both thicken; another read's arc does not.
test('hovering one hop thickens every arc of that read', () => {
  const { targets, inks } = renderOverlay({}, [ARC, NEXT_HOP, OTHER])

  fireEvent.mouseEnter(targets[0]!)

  expect(strokeWidth(inkFor(inks, ARC))).toBe(3)
  expect(strokeWidth(inkFor(inks, NEXT_HOP))).toBe(3)
  expect(strokeWidth(inkFor(inks, OTHER))).toBe(1)

  fireEvent.mouseLeave(targets[0]!)
  expect(strokeWidth(inkFor(inks, NEXT_HOP))).toBe(1)
})

// Selection is read off the model rather than remembered from the last click,
// so clearing it on the canvas un-thickens the arc.
test('an arc is thick while the model selects either of its reads', () => {
  const { inks } = renderOverlay({ selectedFeatureId: 'readB' }, [ARC, OTHER])
  expect(strokeWidth(inkFor(inks, ARC))).toBe(5)
  expect(strokeWidth(inkFor(inks, OTHER))).toBe(1)
})

test('a chain selection thickens every arc of the chain', () => {
  const { inks } = renderOverlay({ selectedChainReadIds: CHAIN }, [
    ARC,
    NEXT_HOP,
    OTHER,
  ])
  expect(strokeWidth(inkFor(inks, ARC))).toBe(5)
  expect(strokeWidth(inkFor(inks, NEXT_HOP))).toBe(5)
  expect(strokeWidth(inkFor(inks, OTHER))).toBe(1)
})

// The ink is 1px at rest. The target the cursor has to land on is wider by the
// same slop the arc band and `CrossRegionArcsOverlay` give theirs.
test('the hover target is wider than the ink', () => {
  const { target, inks } = renderOverlay()
  expect(strokeWidth(inks[0]!)).toBe(1)
  expect(strokeWidth(target)).toBe(7)
})

test('a dashed arc names the loci it skipped in its tooltip', () => {
  const { model, target } = renderOverlay({}, [
    { ...ARC, dash: '4 3', hiddenSegmentsBetween: ['chr2:1-100'] },
  ])

  fireEvent.mouseEnter(target)

  expect(model.setHoverState).toHaveBeenCalledWith(
    expect.objectContaining({
      mouseoverExtraInformation: 'Deletion<br/>hidden: chr2:1-100',
    }),
  )
})
