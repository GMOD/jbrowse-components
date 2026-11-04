/**
 * @jest-environment <rootDir>/config/jest/jsdom.cjs
 */
/// <reference types="jest" />
import { featureRectInPage } from './featureAnchor.ts'

const TRACK = { left: 10, top: 100, width: 800, height: 300 }

const GENE = { left: 100, top: 20, width: 300, height: 10 }

function setSession(boxes: Record<string, { left: number; width: number }[]>) {
  const el = document.createElement('div')
  el.dataset.testid = 'trackRenderingContainer-lgv-genes'
  el.getBoundingClientRect = () => TRACK as DOMRect
  document.body.append(el)
  ;(window as unknown as { JBrowseSession: unknown }).JBrowseSession = {
    views: [
      {
        id: 'lgv',
        assemblyNames: ['hg38'],
        getHighlightCoords: ({
          start,
          end,
        }: {
          start: number
          end: number
        }) => ({ left: start / 10, width: Math.max(3, (end - start) / 10) }),
        tracks: [
          {
            configuration: { trackId: 'genes' },
            displays: [
              {
                featuresNamed: (name: string) =>
                  (boxes[name] ?? []).map((b, i) => ({
                    featureId: `${name}-${i}`,
                    box: { ...GENE, ...b },
                  })),
              },
            ],
          },
        ],
      },
    ],
  }
}

const rect = (name: string, region?: { start: number; end: number }) =>
  featureRectInPage(
    [0],
    'genes',
    name,
    region && { refName: 'chr1', ...region },
  )

beforeAll(() => {
  ;(globalThis as { CSS?: unknown }).CSS ??= { escape: (s: string) => s }
})

beforeEach(() => {
  document.body.replaceChildren()
})

test('a feature is the box its display drew', () => {
  setSession({ TP53: [{ left: 100, width: 300 }] })
  expect(rect('TP53')).toEqual({ left: 110, top: 120, width: 300, height: 10 })
})

test('a locus narrows the box to the part of the feature it covers', () => {
  setSession({ TP53: [{ left: 100, width: 300 }] })
  expect(rect('TP53', { start: 2000, end: 2030 })).toEqual({
    left: 210,
    top: 120,
    width: 3,
    height: 10,
  })
})

test('a point locus is a zero-width line through the feature', () => {
  setSession({ TP53: [{ left: 100, width: 300 }] })
  expect(rect('TP53', { start: 2000, end: 2000 })).toEqual({
    left: 210,
    top: 120,
    width: 0,
    height: 10,
  })
})

test('a locus overhanging the feature clamps to its ends', () => {
  setSession({ TP53: [{ left: 100, width: 300 }] })
  expect(rect('TP53', { start: 500, end: 5000 })).toEqual({
    left: 110,
    top: 120,
    width: 300,
    height: 10,
  })
})

test('a locus picks one of two copies, and a name on two copies alone misses', () => {
  setSession({
    'C -> T': [
      { left: 100, width: 10 },
      { left: 600, width: 10 },
    ],
  })
  expect(rect('C -> T')).toBeUndefined()
  expect(rect('C -> T', { start: 6000, end: 6050 })).toEqual({
    left: 610,
    top: 120,
    width: 5,
    height: 10,
  })
})
