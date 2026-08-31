import { exportMargin } from '@jbrowse/core/svg/constants'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import {
  fakeDotplotInstanceData,
  fakeDotplotRpcData,
} from '../../DotplotDisplay/testUtils.ts'
import { renderToSvg } from './SVGDotplotView.tsx'

import type { DotplotViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// the session comes back alongside the view: `getSession(view)` types as
// AbstractSessionModel, which has no addTrackConf
async function setup() {
  const session = createTestSession()
  addVolvoxAssembly(session)
  const view = session.addView('DotplotView', {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
  }) as DotplotViewModel
  view.setWidth(800)
  // Causal, not a wall clock: the only async precondition here is the assembly
  // load, so await that and let `when` resolve on the reaction tick after it.
  // The 15s deadline this replaces sat INSIDE a shorter jest budget, so it could
  // only ever fire before jest's own and told you nothing extra - and under a
  // loaded machine (several suites plus a build) it fired on work that normally
  // takes a few hundred ms, which is the flake it produced.
  await session.assemblyManager.waitForAssembly('volvox')
  await when(() => view.initialized)
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

// Every display paints the one plot rect, so a failed track has nowhere to
// report itself that isn't over the tracks that did render — and a figure with a
// red rect in it is worse than an export that says why and produces nothing.
// Both names, because the view fans its displays out through `awaitSvgRenders`;
// a plain `Promise.all` would let whichever display rejected first decide the
// whole message and send the user back for a second export to find the other.
test('an errored track fails the export, naming every track that failed', async () => {
  const { session, view } = await setup()
  for (const trackId of ['synteny1', 'synteny2']) {
    session.addSessionTrackConf({
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
  // reports the terminal state, and both displays must be in it at once. After
  // the fetches land, so the autorun that clears the error before a fetch isn't
  // still to come.
  await when(() => view.dotplotDisplays.every(d => d.ready))
  // setError logs, and these errors are the fixture — keep them off stderr
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  for (const display of view.dotplotDisplays) {
    display.setError(new Error(`${display.trackId} failed`))
  }
  log.mockRestore()

  await expect(renderToSvg(view, {})).rejects.toThrow(
    /synteny1 failed[\s\S]*synteny2 failed/,
  )
}, 20000)

// The legend's own group, by the same depth-walk as clipGroupContents: the plot
// is full of unrelated numbers (tick labels, coordinates, path data), so a bare
// `svg.toContain('75')` passes whether or not the ramp is labelled at all.
function legendContents(svg: string) {
  const open = svg.search(/<g transform="translate\([\d.]+ 4\)"/)
  expect(open).toBeGreaterThan(-1)
  let depth = 0
  for (const tag of svg.slice(open).matchAll(/<(\/?)g[\s>]/g)) {
    depth += tag[1] ? -1 : 1
    if (depth === 0) {
      return svg.slice(open, open + tag.index)
    }
  }
  throw new Error('legend group never closed')
}

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

// An `attribute:<column>` ramp has no declared domain, so the legend's end
// labels come from what the loaded data spanned — and an absent range is not a
// missing legend, it is a legend confidently labelled "0 → 0"
// (`resolveContinuousMode` defaults min/max to 0). So the failure this guards
// against is silent on both sides: the export renders a legend, and it disagrees
// with the screen it was exported from.
//
// Asserted through `renderToSvg` rather than on the model, because the model
// getter was already right when this was wrong: the prop simply wasn't passed at
// this call site. Same for the on-screen and synteny-side legends, which read
// the same getter through three more call sites of their own.
test('an exported attribute ramp is labelled with the loaded span, not 0', async () => {
  const { session, view } = await setup()
  session.addSessionTrackConf({
    trackId: 'ortho',
    name: 'ortho',
    type: 'SyntenyTrack',
    assemblyNames: ['volvox', 'volvox'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { uri: 'ortho.paf', locationType: 'UriLocation' },
      assemblyNames: ['volvox', 'volvox'],
    },
  })
  view.showTrack('ortho')
  await when(() => view.dotplotDisplays.every(d => d.ready))

  // Committed directly rather than fetched, the way the errored-tracks test
  // above sets its terminal state: what matters here is that a display holding
  // a range gets it into the exported legend.
  const rpcData = fakeDotplotRpcData({
    attributes: { goc: new Float32Array([75]) },
    attributeRanges: { goc: { min: 0, max: 75 } },
    refNameDict: ['ctgA'],
    mateRefNameDict: ['ctgA'],
  })
  for (const display of view.dotplotDisplays) {
    // `currentFetchKey`, so `dataCurrent` holds and the export's svgReady gate
    // opens instead of waiting out the whole test on a key that never matches
    display.setRpcData(rpcData, display.currentFetchKey, [])
    // svgReady also wants instance geometry; nothing needs to be IN it, the
    // legend is drawn outside the plot rect
    display.setInstanceData(fakeDotplotInstanceData(0))
  }
  view.setColorBy('attribute:goc')
  view.setShowColorLegend(true)

  expect(view.attributeRanges).toEqual({ goc: { min: 0, max: 75 } })
  const legend = legendContents(await renderToSvg(view, {}))
  // the ramp's two end labels. Dropping the prop leaves the max labelled '0'
  // too, so the max is the whole assertion — and it has to be read inside the
  // legend, since the plot prints plenty of other numbers.
  expect(legend).toContain('>75<')
  expect(legend).toContain('>0<')
}, 20000)
