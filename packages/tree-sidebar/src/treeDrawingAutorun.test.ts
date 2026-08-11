import { types } from '@jbrowse/mobx-state-tree'

import { buildTree, getLeafNames } from './clusterUtils.ts'
import { clusterLayout } from './hierarchy.ts'
import { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'

import type { ClusterHierarchyNode, HoveredTreeNode } from './types.ts'

const nwk = '((a:1,b:1):1,(c:1,d:1):1):0;'

// jsdom returns null from getContext; the autorun draws nothing useful but we
// only care that it sizes the canvas, which happens after a non-null context.
const stubCtx = {
  setTransform() {},
  clearRect() {},
  translate() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {},
  save() {},
  restore() {},
  arc() {},
  fill() {},
  // Records the fill in force at the time of the call, not just the geometry:
  // `fillStyle` on the stub holds whatever was written last (the node dot), so
  // the band's own color is otherwise unreadable after the frame.
  fillRect: jest.fn(function (this: { fillStyle: string }) {
    bandFills.push(this.fillStyle)
  }),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
} as unknown as CanvasRenderingContext2D

const bandFills: string[] = []

// Backing-store size is CSS px x devicePixelRatio (via render-core getDpr).
const DPR = 2

beforeAll(() => {
  globalThis.devicePixelRatio = DPR
  HTMLCanvasElement.prototype.getContext = (() =>
    stubCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext
})

// `rowHeight: 0` is the fit-to-height sentinel that variants/maf default to;
// only `effectiveRowHeight` resolves it, which is what the autorun must read.
const Display = types
  .model('TestTreeDisplay', {
    height: types.optional(types.number, 40),
    treeAreaWidth: types.optional(types.number, 80),
    rowHeight: types.optional(types.number, 0),
    lineZoneHeight: types.optional(types.number, 0),
  })
  .volatile(() => ({
    treeCanvas: null as HTMLCanvasElement | null,
    mouseoverCanvas: null as HTMLCanvasElement | null,
    hoveredTreeNode: undefined as HoveredTreeNode | undefined,
  }))
  .views(self => ({
    get effectiveRowHeight() {
      return self.rowHeight === 0 ? self.height / 4 : self.rowHeight
    },
    get totalHeight() {
      return self.height
    },
    get scrollTop() {
      return 0
    },
    get sources() {
      return [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }]
    },
    get hierarchy(): ClusterHierarchyNode {
      return clusterLayout(buildTree(nwk), self.height, self.treeAreaWidth)
    },
  }))
  .actions(self => ({
    setHeight(n: number) {
      self.height = n
    },
    setTreeCanvasRef(ref: HTMLCanvasElement | null) {
      self.treeCanvas = ref
    },
    setMouseoverCanvasRef(ref: HTMLCanvasElement | null) {
      self.mouseoverCanvas = ref
    },
    setHoveredTreeNode(node?: HoveredTreeNode) {
      self.hoveredTreeNode = node
    },
  }))

const View = types
  .model('TestView', {
    id: types.identifier,
    width: types.optional(types.number, 800),
    initialized: types.optional(types.boolean, true),
    display: types.optional(Display, {}),
  })
  .actions(self => ({
    setWidth(n: number) {
      self.width = n
    },
  }))

// `getSession` duck-types on rpcManager + configuration; the draw autoruns read
// the palette off it — the branch-line stroke from `mode`, the hover mark from
// `highlight` as well, so the stub carries both halves of what they resolve.
// The one color the hover mark is built from, so a test can assert the alpha
// it was composited at rather than a literal.
const HIGHLIGHT = '#FFB11D'

const Session = types
  .model('TestSession', {
    view: View,
  })
  .volatile(() => ({
    rpcManager: {},
    configuration: {},
    palette: { mode: 'light', highlight: { main: HIGHLIGHT } },
  }))
  .actions(self => ({
    setMode(mode: 'light' | 'dark') {
      self.palette = { mode, highlight: { main: HIGHLIGHT } }
    },
  }))

function createDisplay(id: string) {
  return Session.create({ view: { id } })
}

test('autorun sizes the tree canvas itself, surviving a height change', () => {
  const { display } = createDisplay('view1').view
  setupTreeDrawingAutorun(display)

  const canvas = document.createElement('canvas')
  display.setTreeCanvasRef(canvas)

  // Backing store is DPR x CSS pixels (treeAreaWidth x contentHeight).
  expect(canvas.width).toBe(80 * DPR)
  expect(canvas.height).toBe(40 * DPR)

  // A subtree filter shrinks the row count -> height. The autorun must resize
  // the backing store itself rather than leaving a stale (or React-cleared)
  // canvas; this is the regression guard for the subtree-filter blanking bug.
  display.setHeight(20)
  expect(canvas.width).toBe(80 * DPR)
  expect(canvas.height).toBe(20 * DPR)
})

test('autorun sizes the mouseover canvas to view width x content height', () => {
  const { display } = createDisplay('view2').view
  setupTreeDrawingAutorun(display)

  const canvas = document.createElement('canvas')
  display.setMouseoverCanvasRef(canvas)

  expect(canvas.width).toBe(800 * DPR)
  expect(canvas.height).toBe(40 * DPR)

  display.setHeight(20)
  expect(canvas.height).toBe(20 * DPR)
})

// Reading the raw `rowHeight` here painted zero-height rows, so hovering the
// tree highlighted nothing in fit-to-height mode (variants' default).
//
// One rect for the whole run, not one per row: the fill is translucent and the
// fit-to-height row height is fractional, so abutting rects blend twice over the
// pixel they share and draw a seam at every row boundary.
test('subtree hover highlights the rows as one rect at the resolved row height', () => {
  const { display } = createDisplay('view3').view
  setupTreeDrawingAutorun(display)
  display.setMouseoverCanvasRef(document.createElement('canvas'))

  const fillRect = stubCtx.fillRect as unknown as jest.Mock
  fillRect.mockClear()

  // The root's first child is the (a,b) subtree: rows 0 and 1.
  const node = display.hierarchy.children![0]!
  display.setHoveredTreeNode({ node, descendantNames: getLeafNames(node) })

  expect(fillRect.mock.calls).toEqual([[0, 0, 800, 20]])
})

// A hover whose rows are NOT contiguous still has to mark each block where it
// really is. Reachable while the row set is mid-change: the tree is still drawn
// (the names all match) but a display decorating `sources` can interleave them.
test('subtree hover paints one rect per contiguous block of rows', () => {
  const { display } = createDisplay('view5').view
  setupTreeDrawingAutorun(display)
  display.setMouseoverCanvasRef(document.createElement('canvas'))

  const fillRect = stubCtx.fillRect as unknown as jest.Mock
  fillRect.mockClear()

  // rows are a,b,c,d; highlight a and c
  display.setHoveredTreeNode({
    node: display.hierarchy,
    descendantNames: ['a', 'c'],
  })

  expect(fillRect.mock.calls).toEqual([
    [0, 0, 800, 10],
    [0, 20, 800, 10],
  ])
})

// A hardcoded white panel and a black stroke made the sidebar a bright
// rectangle on a dark-themed track; both now follow the session palette.
test('branch lines take their ink from the session palette', () => {
  const session = createDisplay('view4')
  const { display } = session.view
  setupTreeDrawingAutorun(display)
  display.setTreeCanvasRef(document.createElement('canvas'))

  expect(stubCtx.strokeStyle).toBe('#0008')
  session.setMode('dark')
  expect(stubCtx.strokeStyle).toBe('#fff8')
})

// The hover mark was three `rgba(255,165,0,…)` literals — the last hardcoded
// colors in the package's drawing paths — and its band's 0.2 was picked against
// a light track. A translucent fill composites toward the background behind it,
// so on a dark track that band all but disappeared: the same failure the codon
// fills document and fix with per-mode alphas, and the same one `treeStroke`
// already exists for, one line above it in the same module.
test('the hover mark follows the palette, and holds up in dark mode', () => {
  const session = createDisplay('view6')
  const { display } = session.view
  setupTreeDrawingAutorun(display)
  display.setMouseoverCanvasRef(document.createElement('canvas'))

  const node = display.hierarchy.children![0]!
  bandFills.length = 0
  display.setHoveredTreeNode({ node, descendantNames: getLeafNames(node) })
  const bandLight = bandFills.at(-1)!

  session.setMode('dark')
  const bandDark = bandFills.at(-1)!

  // built from the theme's highlight token, not a literal
  expect(bandLight).toContain('255, 177, 29')
  expect(bandDark).toContain('255, 177, 29')
  // and composited more strongly against a dark background, or it vanishes
  const alphaOf = (color: string) =>
    Number(/([\d.]+)\)$/.exec(color)?.[1] ?? '1')
  expect(alphaOf(bandDark)).toBeGreaterThan(alphaOf(bandLight))
})
