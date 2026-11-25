import { exportMargin } from '@jbrowse/core/svg/constants'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import {
  fakeDotplotInstanceData,
  fakeDotplotRpcData,
} from '../../DotplotDisplay/testUtils.ts'
import { tickLabel } from '../components/util.ts'
import { renderToSvg } from './SVGDotplotView.tsx'

import type { DotplotViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// the PAF tracks read as empty files; each test commits the features it needs
beforeEach(() => {
  fetchMock.mockResponse('')
})

// the session comes back alongside the view: `getSession(view)` types as
// AbstractSessionModel, which has no addTrackConf
async function setup(contigs: [string, number][] = [['ctgA', 16000]]) {
  const session = createTestSession()
  addVolvoxAssembly(session, contigs)
  const view = (await session.launchView('DotplotView', {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
  })) as DotplotViewModel
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

function addVolvoxAssembly(
  session: ReturnType<typeof createTestSession>,
  contigs: [string, number][],
) {
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: contigs.map(([refName, end]) => ({
          refName,
          uniqueId: refName,
          start: 0,
          end,
          seq: 'a'.repeat(end),
        })),
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
  const { session, view } = await setup()
  session.addHighlight({
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
    await view.launchTrack(trackId)
  }
  // set directly rather than by failing a fetch: this asserts how the view
  // reports the terminal state, and both displays must be in it at once. After
  // the fetches land, so the autorun that clears the error before a fetch isn't
  // still to come.
  await when(() => view.dotplotDisplays.every(d => d.fetchLanded))
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
  const open = svg.search(
    /<g transform="translate\([\d.]+ 0\)" data-testid="color-legend"/,
  )
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

// A diagonalized plot's alignments run into the top-right corner, so a key
// floated there covered them; the export widens to park it beside the plot.
test('the color legend is exported beside the plot, which the canvas widens for', async () => {
  const { view } = await setup()
  const plain = await renderToSvg(view, {})
  expect(plain).not.toContain('Identity')

  view.setColorField('identity')
  const svg = await renderToSvg(view, {})
  expect(svg).toContain('Identity')
  expect(clipGroupContents(svg)).not.toContain('Identity')
  const x =
    /<g transform="translate\(([\d.]+) 0\)" data-testid="color-legend"/.exec(
      svg,
    )
  expect(Number(x![1])).toBeGreaterThan(view.viewWidth)
  const svgWidth = (s: string) =>
    Number(/<svg[^>]* width="([\d.]+)"/.exec(s)![1])
  expect(svgWidth(svg)).toBeGreaterThan(svgWidth(plain))
}, 20000)

// A strand-colored figure used to export with nothing saying which of the two
// colors is the inversion.
test('a strand-colored plot exports its two-color key', async () => {
  const { view } = await setup()
  view.setColorField('strand')
  const legend = legendContents(await renderToSvg(view, {}))
  expect(legend).toContain('>forward<')
  expect(legend).toContain('>reverse<')
}, 20000)

// A column's ramp has no declared domain, so the legend's end labels come
// from what the loaded data spanned — and an absent range is not a
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
  await view.launchTrack('ortho')
  await when(() => view.dotplotDisplays.every(d => d.fetchLanded))

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
    // stamped with the live key, so `dataCurrent` holds and the export's
    // svgReady gate opens instead of waiting out the whole test on a key that
    // never matches
    display.commitFetchResult(() => {
      display.setRpcData(rpcData, [], display.regionSignature)
    }, display.currentFetchKey!)
    // svgReady also wants instance geometry; nothing needs to be IN it, the
    // legend is drawn outside the plot rect
    display.setInstanceData(fakeDotplotInstanceData(0))
  }
  view.setColorField('goc')

  expect(view.attributeRanges).toEqual({ goc: { min: 0, max: 75 } })
  const legend = legendContents(await renderToSvg(view, {}))
  // the ramp's two end labels. Dropping the prop leaves the max labelled '0'
  // too, so the max is the whole assertion — and it has to be read inside the
  // legend, since the plot prints plenty of other numbers.
  expect(legend).toContain('>75<')
  expect(legend).toContain('>0<')
}, 20000)

test('with tick labels off the export keeps the tick marks and names but prints no coordinates', async () => {
  const { view } = await setup()
  const numbered = view.hview.visibleTickPositions.filter(t => t.labeled)
  expect(numbered.length).toBeGreaterThan(0)
  const labels = numbered.map(({ tick }) => tickLabel(tick, view.hview.bpPerPx))
  const on = await renderToSvg(view, {})
  for (const label of labels) {
    expect(on).toContain(`>${label}</text>`)
  }

  view.setAxisLabels(false)
  const off = await renderToSvg(view, {})
  for (const label of labels) {
    expect(off).not.toContain(`>${label}</text>`)
  }
  expect(off).toContain('>ctgA</text>')
  expect(off.match(/<line/g)?.length).toBe(on.match(/<line/g)?.length)
}, 20000)

function axisTexts(svg: string) {
  return [
    ...new DOMParser()
      .parseFromString(svg, 'image/svg+xml')
      .querySelectorAll('text'),
  ]
}

test('axis text is placed by y alone, with no baseline attribute', async () => {
  const { view } = await setup()
  const svg = await renderToSvg(view, {})
  expect(svg).not.toContain('baseline')
  const texts = axisTexts(svg)
  const ys = (pick: (t: Element) => boolean) =>
    new Set(texts.filter(pick).map(t => t.getAttribute('y')))
  const rotated = (t: Element) =>
    /^rotate\(-90,[\d.]+,0\)$/.test(t.getAttribute('transform') ?? '')
  const named = (t: Element) => t.querySelector('title') !== null

  // horizontal tick labels, rotated -90° and centred across their tick
  expect(ys(t => rotated(t) && !named(t))).toEqual(new Set(['2.8']))
  // the horizontal refName hangs 3px clear of the tick at its start
  expect(ys(t => rotated(t) && named(t))).toEqual(new Set(['10.3']))
  // each vertical tick label hangs 3px above its tick
  const tick = view.vview.visibleTickPositions.findLast(t => t.labeled)!
  const label = texts.find(
    t =>
      t.textContent === tickLabel(tick.tick, view.vview.bpPerPx) &&
      !t.hasAttribute('transform'),
  )
  expect(Number(label?.getAttribute('y'))).toBeCloseTo(
    view.vview.toScreenPx(tick.alongPx) - 3 + 7.3,
    2,
  )
  // the horizontal axis title hangs 12px above the bottom of the axis band
  const title = texts.find(
    t => t.textContent.startsWith('volvox') && !t.hasAttribute('transform'),
  )
  expect(Number(title?.getAttribute('y'))).toBeCloseTo(
    view.borderY - 12 + 11 * 0.73,
    2,
  )
}, 20000)

test('a vertical tick label within 10px of the top edge is not drawn', async () => {
  const { view } = await setup()
  const { vview } = view
  vview.scrollTo(vview.offsetPx - 20)
  const top = vview.visibleTickPositions.findLast(t => t.labeled)!
  expect(top.alongPx).toBeGreaterThan(vview.width - 10)
  expect(top.alongPx).toBeLessThan(vview.width)
  const text = tickLabel(top.tick, vview.bpPerPx)
  const vertical = axisTexts(await renderToSvg(view, {})).filter(
    t => t.textContent === text && !t.hasAttribute('transform'),
  )
  expect(vertical).toHaveLength(0)
}, 20000)

// The last tick of a region sits on the next region's start, where its name is
test('a tick label never prints over a refName label', async () => {
  const { view } = await setup([
    ['ctgA', 20000],
    ['ctgB', 20000],
  ])
  const { hview, vview } = view
  const boundary = (axis: typeof hview) => {
    const start = axis.refNameLabelStartsPx[1]!
    const tick = axis.visibleTickPositions.find(
      t => t.labeled && Math.abs(t.alongPx - start) < 5,
    )
    expect(tick).toBeDefined()
    return tick!
  }
  const h = boundary(hview)
  const v = boundary(vview)
  const texts = axisTexts(await renderToSvg(view, {}))
  const hLabels = texts.filter(t => {
    const x = /^rotate\(-90,([\d.]+),0\)$/.exec(
      t.getAttribute('transform') ?? '',
    )?.[1]
    return (
      x !== undefined &&
      t.querySelector('title') === null &&
      Math.abs(Number(x) - h.alongPx) < 1
    )
  })
  const vLabels = texts.filter(
    t =>
      !t.hasAttribute('transform') &&
      Math.abs(
        Number(t.getAttribute('y')) - (vview.toScreenPx(v.alongPx) - 3 + 7.3),
      ) < 1,
  )
  expect(hLabels.map(t => t.textContent)).toEqual([])
  expect(vLabels.map(t => t.textContent)).toEqual([])
}, 20000)

test('a vertical refName label ends clear of the tick at its start', async () => {
  const { view } = await setup()
  const named = axisTexts(await renderToSvg(view, {})).filter(
    t => t.querySelector('title') !== null && !t.hasAttribute('transform'),
  )
  expect(named.length).toBeGreaterThan(0)
  for (const t of named) {
    expect(Number(t.getAttribute('x'))).toBeLessThan(view.borderX - 6)
  }
}, 20000)
