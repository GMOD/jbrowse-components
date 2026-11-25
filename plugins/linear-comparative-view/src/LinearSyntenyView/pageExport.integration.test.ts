import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
})

async function launch() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('one'))
  session.addAssemblyConf(assembly('two'))
  const view = (await session.launchView('LinearSyntenyView', {
    views: [{ assembly: 'one' }, { assembly: 'two' }],
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.pendingLaunch === undefined && view.initialized)
  return view
}

function rootOf(svg: string) {
  return /<svg\b[^>]*>/.exec(svg)?.[0] ?? ''
}

test('a page export lays every row out to fill the page and states its size', async () => {
  const view = await launch()
  const svg = await view.exportSvg({ pageWidth: '183mm', save: false })
  const root = rootOf(svg)
  expect(root).toContain('width="183mm"')
  expect(root).toMatch(/viewBox="0 0 963 /)
  expect(view.width).toBe(800)
  expect(view.views.map(row => row.width)).toEqual([800, 800])
})

test('a px export keeps its window width and margins', async () => {
  const view = await launch()
  const root = rootOf(await view.exportSvg({ save: false }))
  expect(root).toContain('width="900"')
})

test('a page too narrow for its text is refused before the rows are resized', async () => {
  const view = await launch()
  await expect(
    view.exportSvg({ pageWidth: '30mm', save: false }),
  ).rejects.toThrow('widen the figure or lower the text size')
  expect(view.views.map(row => row.width)).toEqual([800, 800])
})

test("each row's ruler numbers clear the refName label above them", async () => {
  const view = await launch()
  const svg = await view.exportSvg({ save: false })
  const baselines = (pattern: RegExp) =>
    [...svg.matchAll(pattern)].map(match => Number(match[1]))
  const refNameBaselines = baselines(
    /<text[^>]*y="([\d.]+)"[^>]*font-weight="bold"/g,
  )
  const tickNumberBaselines = baselines(
    /<text[^>]*y="([\d.]+)" text-anchor="middle" font-size="11"/g,
  )
  const elevenPxAscent = 10
  const elevenPxDescent = 3
  expect(refNameBaselines).toHaveLength(2)
  expect(tickNumberBaselines.length).toBeGreaterThan(0)
  expect(
    Math.min(...tickNumberBaselines) -
      elevenPxAscent -
      (Math.max(...refNameBaselines) + elevenPxDescent),
  ).toBeGreaterThanOrEqual(2)
})
