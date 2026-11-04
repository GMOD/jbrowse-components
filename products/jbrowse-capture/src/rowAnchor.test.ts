/**
 * @jest-environment <rootDir>/config/jest/jsdom.cjs
 */
/// <reference types="jest" />
import { rowRectInPage } from './rowAnchor.ts'

const TRACK = { left: 10, top: 100, width: 800, height: 300 }

const rows = (...names: string[]) =>
  names.map(name => ({ name, label: `${name} label` }))

interface DisplayOverrides {
  sources?: { name: string; label?: string }[]
  bandedSources?: { name: string; label?: string }[]
  rowBands?: { key: string; label: string; start: number; end: number }[]
  rowsTopOffset?: number
  effectiveRowHeight?: number
  scrollTop?: number
  scrollViewportHeight?: number
}

function setSession(overrides: DisplayOverrides = {}) {
  const sources = overrides.sources ?? rows('a', 'b', 'c', 'd')
  const display = {
    sources,
    bandedSources: overrides.bandedSources ?? sources,
    rowBands: [],
    rowsTopOffset: 40,
    effectiveRowHeight: 20,
    scrollTop: 0,
    scrollViewportHeight: 200,
    ...overrides,
  }
  const el = document.createElement('div')
  el.dataset.testid = 'trackRenderingContainer-lgv-vcf'
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
        }) => ({ left: start / 10, width: (end - start) / 10 }),
        tracks: [
          {
            configuration: { trackId: 'vcf' },
            displays: [{ sources: 'not rows' }, display],
          },
        ],
      },
    ],
  }
}

const rect = (name: string, region?: { start: number; end: number }) =>
  rowRectInPage([0], 'vcf', name, region && { refName: 'chr1', ...region })

beforeAll(() => {
  ;(globalThis as { CSS?: unknown }).CSS ??= { escape: (s: string) => s }
})

beforeEach(() => {
  document.body.replaceChildren()
})

test('a row is its strip under the bands above the rows, across the track', () => {
  setSession()
  expect(rect('c')).toEqual({ left: 10, top: 180, width: 800, height: 20 })
})

test('a display that does not scroll its rows shows them all', () => {
  setSession({ scrollViewportHeight: 0 })
  expect(rect('d')).toEqual({ left: 10, top: 200, width: 800, height: 20 })
})

test('a row answers to the label its sidebar shows', () => {
  setSession()
  expect(rect('b label')).toEqual(rect('b'))
})

test('a loc narrows the strip to the locus, and a point locus to a line', () => {
  setSession()
  expect(rect('a', { start: 1000, end: 3000 })).toEqual({
    left: 110,
    top: 140,
    width: 200,
    height: 20,
  })
  expect(rect('a', { start: 1000, end: 1000 })?.width).toBe(0)
})

test('the rows scroll under the bands, and a row scrolled away misses', () => {
  setSession({ scrollTop: 30 })
  expect(rect('b')).toEqual({ left: 10, top: 140, width: 800, height: 10 })
  expect(rect('a')).toBeUndefined()
})

test('a row below the rows viewport misses, and one it cuts is cut', () => {
  setSession({ scrollViewportHeight: 50 })
  expect(rect('d')).toBeUndefined()
  expect(rect('c')?.height).toBe(10)
})

test('a row past the bottom of the track misses', () => {
  setSession({ scrollViewportHeight: 1000, effectiveRowHeight: 100 })
  expect(rect('d')).toBeUndefined()
})

test('a name no drawn row has misses', () => {
  setSession({ sources: rows('a', 'c') })
  expect(rect('b')).toBeUndefined()
})

test('a name two rows answer to misses rather than picking one', () => {
  setSession({ sources: [{ name: 'a' }, { name: 'b', label: 'a' }] })
  expect(rect('a')).toBeUndefined()
})

test('a band is the strip its drawn rows take', () => {
  setSession({
    rowBands: [
      { key: 'std', label: 'Standard', start: 0, end: 2 },
      { key: 'inv', label: 'In(2L)t', start: 2, end: 4 },
    ],
  })
  expect(rect('In(2L)t')).toEqual({
    left: 10,
    top: 180,
    width: 800,
    height: 40,
  })
  expect(rect('std')).toEqual({ left: 10, top: 140, width: 800, height: 40 })
})

test('a band spans only its drawn rows where the display drops one', () => {
  setSession({
    sources: rows('b', 'c'),
    bandedSources: rows('ref', 'b', 'c'),
    rowBands: [
      { key: 'one', label: 'One', start: 0, end: 2 },
      { key: 'two', label: 'Two', start: 2, end: 3 },
    ],
  })
  expect(rect('One')).toEqual(rect('b'))
  expect(rect('Two')).toEqual(rect('c'))
})

test('a band whose name a row also answers to misses', () => {
  setSession({
    rowBands: [{ key: 'a', label: 'A', start: 0, end: 2 }],
  })
  expect(rect('a')).toBeUndefined()
})

test('a track with no row display misses', () => {
  setSession()
  expect(rowRectInPage([0], 'genes', 'a', undefined)).toBeUndefined()
})
