import { types } from '@jbrowse/mobx-state-tree'

import { buildTree } from './clusterUtils.ts'
import { clusterLayout } from './hierarchy.ts'
import { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'

import type { ClusterHierarchyNode } from './types.ts'

const nwk = '((a:1,b:1):1,(c:1,d:1):1):0;'

// jsdom returns null from getContext; the autorun draws nothing useful but we
// only care that it sizes the canvas, which happens after a non-null context.
const stubCtx = {
  resetTransform() {},
  scale() {},
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
  fillRect() {},
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
} as unknown as CanvasRenderingContext2D

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() =>
    stubCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext
})

const Display = types
  .model('TestTreeDisplay', {
    height: types.optional(types.number, 40),
    treeAreaWidth: types.optional(types.number, 80),
    rowHeight: types.optional(types.number, 10),
    lineZoneHeight: types.optional(types.number, 0),
  })
  .volatile(() => ({
    treeCanvas: null as HTMLCanvasElement | null,
    mouseoverCanvas: null as HTMLCanvasElement | null,
  }))
  .views(self => ({
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

  // Backing store is 2x CSS pixels (treeAreaWidth x contentHeight).
  expect(canvas.width).toBe(80 * 2)
  expect(canvas.height).toBe(40 * 2)

  // A subtree filter shrinks the row count -> height. The autorun must resize
  // the backing store itself rather than leaving a stale (or React-cleared)
  // canvas; this is the regression guard for the subtree-filter blanking bug.
  display.setHeight(20)
  expect(canvas.width).toBe(80 * 2)
  expect(canvas.height).toBe(20 * 2)
})

test('autorun sizes the mouseover canvas to view width x content height', () => {
  const { display } = View.create({ id: 'view2' })
  setupTreeDrawingAutorun(display)

  const canvas = document.createElement('canvas')
  display.setMouseoverCanvasRef(canvas)

  expect(canvas.width).toBe(800)
  expect(canvas.height).toBe(40)

  display.setHeight(20)
  expect(canvas.height).toBe(20)
})
