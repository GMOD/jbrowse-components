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
  fillRect: jest.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
} as unknown as CanvasRenderingContext2D

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

test('autorun sizes the tree canvas itself, surviving a height change', () => {
  const { display } = View.create({ id: 'view1' })
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
  const { display } = View.create({ id: 'view2' })
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
test('subtree hover highlights rows at the resolved row height', () => {
  const { display } = View.create({ id: 'view3' })
  setupTreeDrawingAutorun(display)
  display.setMouseoverCanvasRef(document.createElement('canvas'))

  const fillRect = stubCtx.fillRect as unknown as jest.Mock
  fillRect.mockClear()

  // The root's first child is the (a,b) subtree: rows 0 and 1.
  const node = display.hierarchy.children![0]!
  display.setHoveredTreeNode({ node, descendantNames: getLeafNames(node) })

  expect(fillRect.mock.calls).toEqual([
    [0, 0, 800, 10],
    [0, 10, 800, 10],
  ])
})
