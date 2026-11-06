import AlignmentsPlugin, {
  isLinearAlignmentsDisplay,
} from '@jbrowse/plugin-alignments'

import { fetchTrackData } from '../../../core/src/pluggableElementTypes/models/components/fetchTrackData.ts'
import { SV_READS } from '../volvox.fixture.ts'
import { VOLVOX_CONTIGS, standUpDisplay } from './testEnv.ts'

import type { ExportableTrack } from '../../../core/src/pluggableElementTypes/models/components/fetchTrackData.ts'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments/LinearAlignmentsDisplay/stateModel'

interface Window {
  refName: string
  start: number
  end: number
}

function isExportableTrack(track: unknown): track is ExportableTrack {
  return (
    typeof track === 'object' &&
    track !== null &&
    'saveTrackFileFormatOptions' in track &&
    'activeDisplay' in track
  )
}

/**
 * The depth the coverage bands draw at each base of `region`, summed over
 * the lanes on screen.
 */
function bandDepths(display: LinearAlignmentsDisplayModel, region: Window) {
  const depths = new Array<number>(region.end - region.start).fill(0)
  for (const { groups } of display.rpcDataMap.values()) {
    for (const { key, data } of groups) {
      if (!display.hiddenGroups.has(key)) {
        for (let pos = region.start; pos < region.end; pos++) {
          depths[pos - region.start]! +=
            data.coverageDepths[pos - data.coverageStartPos] ?? 0
        }
      }
    }
  }
  return depths
}

/** The bedGraph's depth at each base of `region`, 0 where it has no row. */
function fileDepths(bedGraph: string, region: Window) {
  const depths = new Array<number>(region.end - region.start).fill(0)
  for (const line of bedGraph.trim().split('\n').filter(Boolean)) {
    const [, start, end, depth] = line.split('\t')
    for (let pos = +start!; pos < +end!; pos++) {
      depths[pos - region.start] = +depth!
    }
  }
  return depths
}

async function saved(
  displayConfig: Record<string, unknown>,
  region: Window = SV_READS.region,
) {
  const { display, view, dispose } =
    await standUpDisplay<LinearAlignmentsDisplayModel>({
      plugins: [new AlignmentsPlugin()],
      track: { type: 'AlignmentsTrack', adapter: SV_READS.adapterConfig },
      displayType: 'LinearAlignmentsDisplay',
      isDisplay: isLinearAlignmentsDisplay,
      displayConfig,
      regions: [region],
      contigLengths: VOLVOX_CONTIGS,
      bpPerPx: 5,
    })
  const track = view.tracks[0]
  if (!isExportableTrack(track)) {
    throw new Error('the view holds no exportable track')
  }
  const save = (type: string) =>
    fetchTrackData({
      model: track,
      regions: [{ ...region, assemblyName: 'volvox' }],
      type,
      options: track.saveTrackFileFormatOptions(),
      force: true,
    })
  const coverage = await save('coverage')
  const sam = await save('sam')
  const band = bandDepths(display, region)
  dispose()
  return { band, file: fileDepths(coverage.str, region), sam }
}

const svSignal = [{ field: 'svSignal', equal: true }]

describe("Save track data's bedGraph is the depth the coverage bands draw", () => {
  test('under a filter that draws only the SV evidence', async () => {
    const { band, file, sam } = await saved({ filter: svSignal })
    expect(sam.filteredOut).toBeGreaterThan(0)
    expect(Math.max(...band)).toBeGreaterThan(0)
    expect(file).toEqual(band)
  })

  test('with a lane hidden under that filter', async () => {
    const { band, file, sam } = await saved({
      filter: svSignal,
      facet: { field: 'strand', hidden: ['-1'] },
    })
    expect(sam.filteredOut).toBeGreaterThan(0)
    expect(Math.max(...band)).toBeGreaterThan(0)
    expect(file).toEqual(band)
  })

  test('with the SV-free lane of an svKind facet hidden', async () => {
    const { band, file, sam } = await saved(
      { facet: { field: 'svKind', hidden: ['none'] } },
      { refName: 'ctgA', start: 1000, end: 3500 },
    )
    expect(sam.filteredOut).toBeGreaterThan(0)
    expect(Math.max(...band)).toBeGreaterThan(0)
    expect(file).toEqual(band)
  })

  test('with no filter, and the read file writes every read', async () => {
    const { band, file, sam } = await saved({})
    expect(sam.filteredOut).toBe(0)
    expect(file).toEqual(band)
  })
})
