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

test('overlay highlights render inside the view clip group', async () => {
  const view = await setup()
  view.addToHighlights({
    refName: 'ctgA',
    start: 5000,
    end: 6000,
    assemblyName: 'volvox',
  })
  const svg = await renderToSvg(view, {})

  // The only <rect>s emitted after the clip group opens are the highlight
  // bands: with no tracks, the feature layer is empty and the trailing axis
  // draws only <line>/<text>. So a rect after the clip marker proves the
  // overlay was placed inside SvgClipRect rather than beside it.
  const clipStart = svg.indexOf('clip-path="url(#clip-ruler')
  expect(clipStart).toBeGreaterThan(-1)
  expect(svg.indexOf('<rect', clipStart)).toBeGreaterThan(clipStart)
}, 20000)
