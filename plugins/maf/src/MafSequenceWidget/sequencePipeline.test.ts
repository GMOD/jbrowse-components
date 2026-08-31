import {
  BedTabixAdapter,
  bedTabixConfigSchema as BedTabixConfigSchema,
} from '@jbrowse/plugin-bed'

import MafTabixAdapter from '../MafTabixAdapter/MafTabixAdapter.ts'
import MafTabixConfigSchema from '../MafTabixAdapter/configSchema.ts'
import { formatFastaSequences } from '../util/formatFastaSequences.ts'
import { processFeaturesToFasta } from '../util/processFeaturesToFasta.ts'

import type { Sample } from '../types.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

/**
 * The whole widget data path against real data: the same adapter the track
 * reads, through the worker function `MafGetSequences` calls, into the string
 * the widget renders and downloads. `processFeaturesToFasta` had unit tests over
 * hand-built features; nothing exercised it on features an adapter actually
 * produces, which is where its one crash lived (a region whose `end` preceded
 * its `start` sized the row buffers negative — see `selectionRegion`).
 */
function adapter() {
  return new MafTabixAdapter(
    MafTabixConfigSchema.create({
      bedGzLocation: {
        localPath:
          require.resolve('../../../../test_data/volvox/volvox.maf.bed.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath:
            require.resolve('../../../../test_data/volvox/volvox.maf.bed.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
    subConf =>
      Promise.resolve({
        dataAdapter: new BedTabixAdapter(
          BedTabixConfigSchema.create(subConf),
        ) as BaseFeatureDataAdapter,
        sessionIds: new Set<string>(),
      }),
  )
}

const REGION: Region = {
  refName: 'ctgA',
  start: 100,
  end: 300,
  assemblyName: 'volvox',
}

const SAMPLES: Sample[] = [
  { id: 'volvox', label: 'volvox' },
  { id: 'simvolvox', label: 'simvolvox' },
  { id: 'absentvolvox', label: 'absentvolvox' },
]

async function fasta(
  opts: { showAllLetters?: boolean; includeInsertions?: boolean } = {},
  region: Region = REGION,
) {
  return processFeaturesToFasta({
    features: await adapter().getFeaturesArray(region),
    samples: SAMPLES,
    regions: [region],
    ...opts,
  })
}

describe('the MAF sequence widget pipeline, over real adapter output', () => {
  it('lays every sample out in reference coordinates', async () => {
    const { rows, colToGenomePos } = await fasta({ showAllLetters: true })
    // one row per requested sample, each the region's width
    expect(rows).toHaveLength(SAMPLES.length)
    for (const row of rows) {
      expect(row).toHaveLength(REGION.end - REGION.start)
    }
    // the column→position map the tooltip and the cross-view highlight read is
    // the same width, and starts at the region
    expect(colToGenomePos).toHaveLength(rows[0]!.length)
    expect(colToGenomePos[0]).toBe(REGION.start)
    expect(colToGenomePos.at(-1)).toBe(REGION.end - 1)
  })

  // The row is laid out against the reference, so a sample the file doesn't
  // carry has to come back as gaps rather than shifting the alignment or
  // throwing — the widget lets you select any rows the display shows.
  it('gives an absent sample an all-gap row, not a missing one', async () => {
    const { rows } = await fasta({ showAllLetters: true })
    expect(rows[2]).toMatch(/^-+$/)
    expect(rows[0]).not.toMatch(/^-+$/)
  })

  it('collapses matches to dots unless every letter is asked for', async () => {
    const shown = await fasta({ showAllLetters: true })
    const collapsed = await fasta({ showAllLetters: false })
    // the reference matches itself everywhere it aligns
    expect(collapsed.rows[0]).toContain('.')
    expect(shown.rows[0]).not.toContain('.')
    // ...and the two agree on width, so a column means the same thing in both
    expect(collapsed.rows[0]).toHaveLength(shown.rows[0]!.length)
  })

  // Inserted columns have no reference base, so they carry the `-1` sentinel.
  // Every row and the map must still be one width or the widget's column hover
  // reads the wrong position.
  it('keeps rows and the position map the same width with insertions in', async () => {
    const { rows, colToGenomePos } = await fasta({
      showAllLetters: true,
      includeInsertions: true,
    })
    for (const row of rows) {
      expect(row).toHaveLength(colToGenomePos.length)
    }
    expect(colToGenomePos.length).toBeGreaterThanOrEqual(
      REGION.end - REGION.start,
    )
    // real positions stay ascending across the inserted columns
    const real = colToGenomePos.filter(p => p >= 0)
    expect(real).toEqual([...real].sort((a, b) => a - b))
  })

  it('formats what the widget copies and downloads', async () => {
    const { rows } = await fasta({ showAllLetters: true })
    const multi = formatFastaSequences(rows, SAMPLES, false)
    expect(multi.startsWith('>volvox\n')).toBe(true)
    // Standard FASTA through core's `formatSeqFasta`: one header line per
    // sample, and the sequence wrapped at 80 columns rather than run out on one
    // long line that some tools will not read.
    const multiLines = multi.split('\n')
    expect(multiLines.filter(l => l.startsWith('>'))).toHaveLength(
      SAMPLES.length,
    )
    const sequenceLines = multiLines.filter(l => !l.startsWith('>'))
    expect(sequenceLines.every(l => l.length <= 80)).toBe(true)
    expect(sequenceLines.some(l => l.length === 80)).toBe(true)
    // every base survives the wrap
    expect(sequenceLines.join('')).toBe(rows.join(''))

    // single-line mode pads the labels to a common width, and the point of the
    // padding is that every record's sequence then begins at the same column —
    // which is what makes the block readable as an alignment in a monospace view
    const lines = formatFastaSequences(rows, SAMPLES, true).split('\n')
    expect(lines).toHaveLength(SAMPLES.length)
    const sequenceStarts = lines.map((line, i) => line.indexOf(rows[i]!))
    expect(sequenceStarts.every(x => x > 0)).toBe(true)
    expect(new Set(sequenceStarts).size).toBe(1)
  })

  // A one-base selection is the narrowest thing a drag can produce.
  it('handles a single-base region', async () => {
    const { rows, colToGenomePos } = await fasta(
      { showAllLetters: true },
      {
        ...REGION,
        start: 150,
        end: 151,
      },
    )
    expect(colToGenomePos).toEqual([150])
    for (const row of rows) {
      expect(row).toHaveLength(1)
    }
  })
})
