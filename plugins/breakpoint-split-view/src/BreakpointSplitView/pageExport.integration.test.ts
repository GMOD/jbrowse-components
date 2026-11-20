import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

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

function rootOf(svg: string) {
  return /<svg\b[^>]*>/.exec(svg)?.[0] ?? ''
}

test('a page export lays every row out to fill the page and states its size', async () => {
  const view = await launch()
  const svg = await view.exportSvg({ pageWidth: '183mm', save: false })
  const root = rootOf(svg)
  expect(root).toContain('width="183mm"')
  expect(root).toMatch(/viewBox="0 0 963 /)
  expect(view.views.map(row => row.width)).toEqual([800, 800])
})

test('a px export keeps its window width and margins', async () => {
  const view = await launch()
  const root = rootOf(await view.exportSvg({ save: false }))
  expect(root).toContain('width="900"')
})
