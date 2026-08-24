import { renderViewTracks } from './renderViewTracks.ts'
import { trackSpacing } from './util.ts'

import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

// The orderings renderViewTracks exists to own. Both were violated by all three
// view exports at some point, and each time only a minute-long integration
// snapshot noticed — these run in milliseconds and say which rule broke.

const TEXT_HEIGHT = 20

interface Opts {
  height: number
  // height the display settles at once its renderSvg resolves, as a grow-mode
  // display does when its data lands
  settlesTo?: number
  legendWidth?: number
  minimized?: boolean
}

function makeTrack(
  name: string,
  { height, settlesTo, legendWidth, minimized = false }: Opts,
  log: string[],
) {
  const display = {
    height,
    svgLegendWidth: () => {
      log.push(`legendWidth:${name}`)
      return legendWidth ?? 0
    },
    renderSvg: async (opts: ExportSvgDisplayOptions) => {
      log.push(`render:${name}:legendWidth=${opts.legendWidth}`)
      await Promise.resolve()
      if (settlesTo !== undefined) {
        display.height = settlesTo
      }
      return null
    },
  }
  return { name, minimized, displays: [display] }
}

function run(
  tracks: {
    pinned: ReturnType<typeof makeTrack>[]
    unpinned: ReturnType<typeof makeTrack>[]
  },
  extra?: { reserveLegendWidth?: boolean },
) {
  return renderViewTracks({
    view: { pinnedTracks: tracks.pinned, unpinnedTracks: tracks.unpinned },
    opts: {},
    theme: undefined,
    textHeight: TEXT_HEIGHT,
    trackLabels: 'offset',
    ...extra,
  })
}

test('the stack is measured after the displays settle, not before', async () => {
  const log: string[] = []
  // a grow-mode display: 20px before its data lands, 300px after
  const track = makeTrack('grow', { height: 20, settlesTo: 300 }, log)

  const { tracksHeight } = await run({ pinned: [], unpinned: [track] })

  // measuring up front would reserve 20 + the label band, and the 300px body
  // rendered into it would run off the bottom of the export
  expect(tracksHeight).toBe(300 + TEXT_HEIGHT + trackSpacing)
})

test('the legend width is measured before the displays render', async () => {
  const log: string[] = []
  const a = makeTrack('a', { height: 10, legendWidth: 40 }, log)
  const b = makeTrack('b', { height: 10, legendWidth: 90 }, log)

  const { legendWidth } = await run(
    { pinned: [], unpinned: [a, b] },
    { reserveLegendWidth: true },
  )

  // the widest wins, and every display is told the reservation — a display
  // decides whether to park its legend outside the plot or float it over the
  // plot from that, so it cannot be resolved after the fact
  expect(legendWidth).toBe(90)
  expect(log).toEqual([
    'legendWidth:a',
    'legendWidth:b',
    'render:a:legendWidth=90',
    'render:b:legendWidth=90',
  ])
})

test('no reservation means displays are told there is no gutter', async () => {
  const log: string[] = []
  const track = makeTrack('a', { height: 10, legendWidth: 40 }, log)

  const { legendWidth } = await run({ pinned: [], unpinned: [track] })

  // the stacked exports (synteny, breakpoint-split) don't widen their canvas,
  // so a display that asked for 40px must not draw as though it got them
  expect(legendWidth).toBe(0)
  expect(log).toEqual(['render:a:legendWidth=0'])
})

test('minimized tracks are dropped from both the render and the measurement', async () => {
  const log: string[] = []
  const shown = makeTrack('shown', { height: 100 }, log)
  const collapsed = makeTrack(
    'collapsed',
    { height: 100, minimized: true },
    log,
  )

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
  const log: string[] = []
  const supported = makeTrack('supported', { height: 100 }, log)
  const unsupported = makeTrack('unsupported', { height: 100 }, log) as {
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
  const log: string[] = []
  const supported = makeTrack('supported', { height: 10, legendWidth: 40 }, log)
  const unsupported = makeTrack(
    'unsupported',
    { height: 10, legendWidth: 300 },
    log,
  ) as { displays: { renderSvg?: unknown }[] }
  delete unsupported.displays[0]!.renderSvg

  const { legendWidth } = await run(
    {
      pinned: [],
      unpinned: [supported, unsupported as ReturnType<typeof makeTrack>],
    },
    { reserveLegendWidth: true },
  )

  // the widest legend belongs to a track that is not drawn, so reserving for it
  // would leave a 300px empty gutter beside the figure
  expect(legendWidth).toBe(40)
})

test('pinned tracks lead, as they do on screen', async () => {
  const log: string[] = []
  const { tracks } = await run({
    pinned: [makeTrack('pinned', { height: 10 }, log)],
    unpinned: [makeTrack('normal', { height: 10 }, log)],
  })

  expect(tracks.map(t => t.name)).toEqual(['pinned', 'normal'])
})
