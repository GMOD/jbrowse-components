/**
 * @jest-environment jsdom
 */
/// <reference types="jest" />
import { locateGraphPaneInPage, nodeGeometryInPage } from './graphAnchor.ts'

const POSITIONS = {
  's1+': [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 10 },
  ],
}

const TRANSFORM = { scaleX: 2, scaleY: 1, translateX: 5, translateY: 7 }

function element(parent: HTMLElement, testid: string) {
  const el = document.createElement('div')
  el.dataset.testid = testid
  parent.append(el)
  return el
}

function canvasAt(parent: HTMLElement, top: number) {
  const canvas = document.createElement('canvas')
  canvas.dataset.testid = 'graph-genome-canvas'
  canvas.getBoundingClientRect = () =>
    ({ left: 10, top, width: 800, height: 300 }) as DOMRect
  parent.append(canvas)
}

function graphTrackElement(view: HTMLElement, trackId: string, top: number) {
  const track = element(view, `trackRenderingContainer-lgv-${trackId}`)
  canvasAt(element(track, 'linear-graph-display'), top)
}

const graphTrack = (trackId: string, nodePositions: object) => ({
  configuration: { trackId },
  displays: [{ pane: { nodePositions, ...TRANSFORM } }],
})

function setSession(views: unknown[]) {
  ;(window as unknown as { JBrowseSession: unknown }).JBrowseSession = { views }
}

const geometry = (trackId: string | undefined, nodeId: string) =>
  nodeGeometryInPage(locateGraphPaneInPage([0], trackId), nodeId)

beforeAll(() => {
  ;(globalThis as { CSS?: unknown }).CSS ??= { escape: (s: string) => s }
})

beforeEach(() => {
  document.body.replaceChildren()
})

test('a standalone GraphGenomeView is its own pane', () => {
  canvasAt(element(document.body, 'view-container-g'), 50)
  setSession([{ id: 'g', nodePositions: POSITIONS, ...TRANSFORM }])
  expect(geometry(undefined, 's1')).toEqual({
    left: 15,
    top: 57,
    width: 400,
    height: 10,
    midX: 215,
    midY: 57,
  })
})

test('a graph track resolves through its display, the first one by default', () => {
  const view = element(document.body, 'view-container-lgv')
  element(view, 'trackRenderingContainer-lgv-genes')
  graphTrackElement(view, 'graph', 100)
  setSession([
    {
      id: 'lgv',
      tracks: [
        { configuration: { trackId: 'genes' }, displays: [{}] },
        graphTrack('graph', POSITIONS),
      ],
    },
  ])
  expect(geometry(undefined, 's1+')?.top).toBe(107)
})

// plugin 4.0.7 composes the pane into the display rather than nesting it
test('a flat graph display is its own pane', () => {
  const view = element(document.body, 'view-container-lgv')
  graphTrackElement(view, 'graph', 100)
  setSession([
    {
      id: 'lgv',
      tracks: [
        {
          configuration: { trackId: 'graph' },
          displays: [
            {
              type: 'LinearGraphDisplay',
              nodePositions: POSITIONS,
              ...TRANSFORM,
            },
          ],
        },
      ],
    },
  ])
  expect(geometry(undefined, 's1+')?.top).toBe(107)
})

test('`track` picks one of several graph tracks, and its own canvas', () => {
  const view = element(document.body, 'view-container-lgv')
  graphTrackElement(view, 'first', 100)
  graphTrackElement(view, 'second', 400)
  setSession([
    {
      id: 'lgv',
      tracks: [graphTrack('first', {}), graphTrack('second', POSITIONS)],
    },
  ])
  expect(geometry(undefined, 's1')).toBeUndefined()
  expect(geometry('second', 's1')?.top).toBe(407)
})

test('a linear view with no graph track locates nothing', () => {
  canvasAt(element(document.body, 'view-container-lgv'), 0)
  setSession([
    {
      id: 'lgv',
      tracks: [{ configuration: { trackId: 'genes' }, displays: [{}] }],
    },
  ])
  expect(locateGraphPaneInPage([0], undefined)).toBeUndefined()
})
