import { pageLayout } from '@jbrowse/plugin-linear-genome-view'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import { drawnConnectionKey } from './components/drawnConnectionKey.ts'
import { breakpointPageSubject } from './svgcomponents/pageSubject.ts'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})
jest.mock('./components/drawnConnectionKey.ts', () => ({
  drawnConnectionKey: jest.fn(() => []),
}))

const KEY_ROWS = [
  { key: 'Variant call', color: '#ff0000', label: 'Variant call' },
]

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'volvox-ctgA',
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
}

async function launch() {
  const session = createTestSession()
  session.addAssemblyConf(assembly)
  const view = (await session.launchView('BreakpointSplitView', {
    views: [
      { assembly: 'volvox', loc: 'ctgA:1-5000' },
      { assembly: 'volvox', loc: 'ctgA:8000-13000' },
    ],
  })) as BreakpointViewModel
  view.setWidth(800)
  await session.assemblyManager.waitForAssembly('volvox')
  await when(() => view.initialized)
  return view
}

function withKeyRows(rows: typeof KEY_ROWS) {
  jest.mocked(drawnConnectionKey).mockReturnValue(rows)
}

function rootSize(svg: string) {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? ''
  return {
    width: Number(/ width="([\d.]+)"/.exec(root)?.[1]),
    height: Number(/ height="([\d.]+)"/.exec(root)?.[1]),
  }
}

function keyTransform(svg: string) {
  return /<g transform="([^"]*)" data-testid="connection-key"/.exec(svg)?.[1]
}

test('no key rows, no gutter', async () => {
  withKeyRows([])
  const view = await launch()
  const svg = await view.exportSvg({ save: false })

  expect(
    breakpointPageSubject(view, {}).legendWidth!(undefined, undefined),
  ).toBe(0)
  expect(rootSize(svg).width).toBe(900)
  expect(keyTransform(svg)).toBeUndefined()
})

test('the key sits in the gutter beside the first row and widens the figure by it', async () => {
  withKeyRows([])
  const view = await launch()
  const without = rootSize(await view.exportSvg({ save: false }))

  withKeyRows(KEY_ROWS)
  const gutter = breakpointPageSubject(view, {}).legendWidth!(
    undefined,
    undefined,
  )
  const svg = await view.exportSvg({ save: false })

  expect(gutter).toBeGreaterThan(0)
  const keyed = rootSize(svg)
  expect(keyed.width).toBeCloseTo(without.width + gutter, 1)
  expect(keyed.height).toBe(without.height)
  const [, x, y] = /translate\(([\d.]+) ([\d.]+)\)/.exec(keyTransform(svg)!)!
  expect(Number(y)).toBe(0)
  expect(Number(x)).toBeGreaterThan(800)
})

test('a page export solves the plot width against the key', async () => {
  const view = await launch()
  const opts = { pageWidth: '183mm' }
  withKeyRows([])
  const plain = pageLayout(breakpointPageSubject(view, opts), opts)!
  withKeyRows(KEY_ROWS)
  const keyed = pageLayout(breakpointPageSubject(view, opts), opts)!

  expect(keyed.plotPx).toBeLessThan(plain.plotPx)
})
