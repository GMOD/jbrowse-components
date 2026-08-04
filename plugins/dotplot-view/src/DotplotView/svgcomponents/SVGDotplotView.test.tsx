import { exportMargin } from '@jbrowse/core/svg/constants'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import { renderToSvg } from './SVGDotplotView.tsx'

import type { DotplotViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// the session comes back alongside the view: `getSession(view)` types as
// AbstractSessionModel, which has no addTrackConf
async function setup() {
  const session = createTestSession()
  addVolvoxAssembly(session)
  const view = session.addView('DotplotView', {
    init: { views: [{ assembly: 'volvox' }, { assembly: 'volvox' }] },
  }) as DotplotViewModel
  view.setWidth(800)
  await when(() => view.initialized, { timeout: 15000 })
  return { session, view }
}

function addVolvoxAssembly(session: ReturnType<typeof createTestSession>) {
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
}

test('export widens the canvas and shifts content into the margin gutter', async () => {
  const { view } = await setup()
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
  const { view } = await setup()
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

// Every display paints the one plot rect, so the terminal state belongs to the
// view: a plot-sized SVGErrorBox per errored display buried the tracks that did
// render (and its own stale geometry, which a failed refetch leaves on screen).
test('errored tracks export one banner, not a plot-sized box each', async () => {
  const { session, view } = await setup()
  for (const trackId of ['synteny1', 'synteny2']) {
    session.addTrackConf({
      trackId,
      name: trackId,
      type: 'SyntenyTrack',
      assemblyNames: ['volvox', 'volvox'],
      adapter: {
        type: 'PAFAdapter',
        pafLocation: { uri: `${trackId}.paf`, locationType: 'UriLocation' },
        assemblyNames: ['volvox', 'volvox'],
      },
    })
    view.showTrack(trackId)
  }
  // set directly rather than by failing a fetch: this asserts how the view
  // renders the terminal state, and both displays must be in it at once. After
  // the fetches land, so the autorun that clears the error before a fetch isn't
  // still to come.
  await when(() => view.dotplotDisplays.every(d => d.ready), { timeout: 15000 })
  // setError logs, and these errors are the fixture — keep them off stderr
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  for (const display of view.dotplotDisplays) {
    display.setError(new Error(`${display.trackId} failed`))
  }
  log.mockRestore()
  const svg = await renderToSvg(view, {})

  expect(svg.match(/fill="#ffdddd"/g)).toHaveLength(1)
  expect(svg).toContain('synteny1 failed')
  expect(svg).toContain('synteny2 failed')
  // a strip across the top of the plot, never a box its full height
  const box =
    /<rect x="0" y="0" width="([\d.]+)" height="([\d.]+)" fill="#ffdddd"/.exec(
      svg,
    )
  expect(Number(box![1])).toBe(view.viewWidth)
  expect(Number(box![2])).toBeLessThan(view.viewHeight)
}, 20000)

test('the color legend is exported outside the clip, at the top right', async () => {
  const { view } = await setup()
  expect(await renderToSvg(view, {})).not.toContain('Default')

  view.setShowColorLegend(true)
  const svg = await renderToSvg(view, {})
  expect(clipGroupContents(svg)).not.toContain('Default')
  // laid out from the right edge of the plot, so past its midpoint
  const x = /<g transform="translate\(([\d.]+) 4\)"/.exec(svg)
  expect(Number(x![1])).toBeGreaterThan(view.viewWidth / 2)
}, 20000)
