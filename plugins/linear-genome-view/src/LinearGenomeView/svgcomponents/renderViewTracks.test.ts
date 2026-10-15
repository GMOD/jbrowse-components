import { svgLegendGutterWidth } from '@jbrowse/display-kit/renderDisplaySvg'

import { renderViewTracks } from './renderViewTracks.ts'
import { trackSpacing } from './util.ts'

// The ordering renderViewTracks exists to own. It was violated by all three
// view exports at some point, and each time only a minute-long integration
// snapshot noticed — these run in milliseconds and say which rule broke.

const TEXT_HEIGHT = 20

interface Opts {
  height: number
  // height the display settles at once its renderSvg resolves, as a grow-mode
  // display does when its data lands
  settlesTo?: number
  // the key's labels, listed only once renderSvg resolves, as a key listing
  // what was loaded is
  keyLabels?: string[]
  regionTooLarge?: boolean
  minimized?: boolean
}

function legendSpecOf(labels: string[]) {
  return {
    sections: labels.length
      ? [{ id: 'k', items: labels.map(label => ({ label, color: 'red' })) }]
      : [],
  }
}

function makeTrack(
  name: string,
  { height, settlesTo, keyLabels, regionTooLarge, minimized = false }: Opts,
) {
  const display = {
    id: name,
    height,
    regionTooLarge,
    showLegend: true,
    legendSpec: legendSpecOf([]),
    setShowLegend() {},
    dismissLegendSection() {},
    renderSvg: async () => {
      await Promise.resolve()
      if (settlesTo !== undefined) {
        display.height = settlesTo
      }
      if (keyLabels) {
        display.legendSpec = legendSpecOf(keyLabels)
      }
      return null
    },
  }
  return { name, minimized, displays: [display] }
}

function gutterFor(labels: string[], maxHeight = Infinity) {
  return svgLegendGutterWidth(
    { id: 'x', showLegend: true, legendSpec: legendSpecOf(labels) },
    undefined,
    maxHeight,
  )
}

function run(tracks: {
  pinned: ReturnType<typeof makeTrack>[]
  unpinned: ReturnType<typeof makeTrack>[]
}) {
  return renderViewTracks({
    view: { pinnedTracks: tracks.pinned, unpinnedTracks: tracks.unpinned },
    opts: {},
    theme: undefined,
    textHeight: TEXT_HEIGHT,
    trackLabels: 'offset',
  })
}

test('the stack is measured after the displays settle, not before', async () => {
  // a grow-mode display: 20px before its data lands, 300px after
  const track = makeTrack('grow', { height: 20, settlesTo: 300 })

  const { tracksHeight } = await run({ pinned: [], unpinned: [track] })

  // measuring up front would reserve 20 + the label band, and the 300px body
  // rendered into it would run off the bottom of the export
  expect(tracksHeight).toBe(300 + TEXT_HEIGHT + trackSpacing)
})

// jbrowse-img measures before any data has landed, so a gutter sized then
// reserved nothing and the key floated over the plot it was meant to sit beside
test('the legend gutter is measured after the displays settle', async () => {
  const a = makeTrack('a', { height: 10, keyLabels: ['short'] })
  const b = makeTrack('b', { height: 10, keyLabels: ['a much longer label'] })

  const { legendWidth } = await run({ pinned: [], unpinned: [a, b] })

  expect(legendWidth).toBeGreaterThan(0)
  expect(legendWidth).toBe(gutterFor(['a much longer label']))
})

test('a stack with no key reserves no gutter', async () => {
  const { legendWidth, displayResults } = await run({
    pinned: [],
    unpinned: [makeTrack('a', { height: 10 })],
  })

  expect(legendWidth).toBe(0)
  expect(displayResults[0]!.legendHeight).toBeUndefined()
})

test("a key's room runs to the next keyed track, or to the foot of the stack", async () => {
  const { displayResults, tracksHeight } = await run({
    pinned: [],
    unpinned: [
      makeTrack('keyed', { height: 10, keyLabels: ['a'] }),
      makeTrack('plain', { height: 100 }),
      makeTrack('last', { height: 50, keyLabels: ['b'] }),
    ],
  })

  const box = (height: number) => height + TEXT_HEIGHT + trackSpacing
  const lastBodyTop = box(10) + box(100) + TEXT_HEIGHT
  expect(displayResults.map(r => r.legendHeight)).toEqual([
    lastBodyTop - TEXT_HEIGHT,
    undefined,
    tracksHeight - lastBodyTop,
  ])
})

// A too-large region draws a note in place of the body, and a key beside a
// note keys nothing
test('a region-too-large track draws no key', async () => {
  const { legendWidth } = await run({
    pinned: [],
    unpinned: [
      makeTrack('a', { height: 10, keyLabels: ['a'], regionTooLarge: true }),
    ],
  })

  expect(legendWidth).toBe(0)
})

test('minimized tracks are dropped from both the render and the measurement', async () => {
  const shown = makeTrack('shown', { height: 100 })
  const collapsed = makeTrack('collapsed', { height: 100, minimized: true })

  const { tracks, displayResults, tracksHeight } = await run({
    pinned: [],
    unpinned: [shown, collapsed],
  })

  expect(tracks.map(t => t.name)).toEqual(['shown'])
  expect(displayResults.map(r => r.track.name)).toEqual(['shown'])
  // a collapsed track reserving a full-height panel is the bug this prevents
  expect(tracksHeight).toBe(100 + TEXT_HEIGHT + trackSpacing)
})

// `renderSvg` is optional so that a display type which never implemented it
// costs its own track a place in the figure rather than costing the whole
// session the ability to export. It used to be called unconditionally, so such
// a display threw and awaitSvgRenders aggregated the throw into an export
// failure that saved nothing.
test('a display with no renderSvg is skipped, not thrown on', async () => {
  const supported = makeTrack('supported', { height: 100 })
  const unsupported = makeTrack('unsupported', { height: 100 }) as {
    name: string
    minimized: boolean
    displays: { height: number; renderSvg?: unknown }[]
  }
  delete unsupported.displays[0]!.renderSvg

  const { tracks, displayResults, tracksHeight, skippedTracks } = await run({
    pinned: [],
    unpinned: [supported, unsupported as ReturnType<typeof makeTrack>],
  })

  expect(tracks.map(t => t.name)).toEqual(['supported'])
  expect(displayResults.map(r => r.track.name)).toEqual(['supported'])
  expect(skippedTracks.map(t => t.name)).toEqual(['unsupported'])
  // and it reserves no height: a labelled empty band where the track would
  // have been is the other way to get this wrong
  expect(tracksHeight).toBe(100 + TEXT_HEIGHT + trackSpacing)
})

test('a skipped track does not enter the legend measurement', async () => {
  const supported = makeTrack('supported', { height: 10, keyLabels: ['a'] })
  const unsupported = makeTrack('unsupported', {
    height: 10,
    keyLabels: ['a label far wider than the drawn key'],
  }) as { displays: { renderSvg?: unknown }[] }
  delete unsupported.displays[0]!.renderSvg

  const { legendWidth } = await run({
    pinned: [],
    unpinned: [supported, unsupported as ReturnType<typeof makeTrack>],
  })

  // the widest key belongs to a track that is not drawn, so reserving for it
  // would leave an empty gutter beside the figure
  expect(legendWidth).toBe(gutterFor(['a']))
})

test('pinned tracks lead, as they do on screen', async () => {
  const { tracks } = await run({
    pinned: [makeTrack('pinned', { height: 10 })],
    unpinned: [makeTrack('normal', { height: 10 })],
  })

  expect(tracks.map(t => t.name)).toEqual(['pinned', 'normal'])
})
