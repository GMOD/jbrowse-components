import { exportMargin } from '@jbrowse/core/svg/constants'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import { renderToSvg } from './SVGDotplotView.tsx'

import type { DotplotViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
        ],
      },
    },
  })
  const view = session.addView('DotplotView', {
    init: { views: [{ assembly: 'volvox' }, { assembly: 'volvox' }] },
  }) as DotplotViewModel
  view.setWidth(800)
  await when(() => view.initialized, { timeout: 15000 })
  return view
}

test('export widens the canvas and shifts content into the margin gutter', async () => {
  const view = await setup()
  const svg = await renderToSvg(view, {})

  // SVGExportRoot pads exportMargin on each side; content is translated to sit
  // inside the left gutter (matches every other view's export)
  expect(svg).toContain(`viewBox="0 0 ${view.width + exportMargin * 2}`)
  expect(svg).toContain(`translate(${exportMargin} 0)`)
}, 20000)

// The markup between the clip group's <g clip-path=…> and its matching </g>.
// Walking the depth is what makes "inside the clip" a real assertion: the
// legend and the horizontal axis both follow the group, so a plain
// indexOf-after-clipStart check passes for content placed beside it.
function clipGroupContents(svg: string) {
  const open = svg.indexOf('<g clip-path="url(#clip-plot')
  expect(open).toBeGreaterThan(-1)
  let depth = 0
  for (const tag of svg.slice(open).matchAll(/<(\/?)g[\s>]/g)) {
    depth += tag[1] ? -1 : 1
    if (depth === 0) {
      return svg.slice(open, open + tag.index)
    }
  }
  throw new Error('clip group never closed')
}

test('overlay highlights render inside the view clip group', async () => {
  const view = await setup()
  view.addToHighlights({
    refName: 'ctgA',
    start: 5000,
    end: 6000,
    assemblyName: 'volvox',
    color: '#ff00ff',
  })
  const svg = await renderToSvg(view, {})

  // an explicit highlight color is used as-is, so it identifies the bands
  // (both axes are volvox, so the region highlights on each)
  expect(clipGroupContents(svg).match(/fill="#ff00ff"/g)).toHaveLength(2)
}, 20000)

test('the color legend is exported outside the clip, at the top right', async () => {
  const view = await setup()
  expect(await renderToSvg(view, {})).not.toContain('Default')

  view.setShowColorLegend(true)
  const svg = await renderToSvg(view, {})
  expect(clipGroupContents(svg)).not.toContain('Default')
  // laid out from the right edge of the plot, so past its midpoint
  const x = /<g transform="translate\(([\d.]+) 4\)"/.exec(svg)
  expect(Number(x![1])).toBeGreaterThan(view.viewWidth / 2)
}, 20000)
