import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { generateCoverageBins } from './generateCoverageBins'

function createMockFeature(data: {
  start: number
  end: number
  strand?: number
  CIGAR?: string
}) {
  return new SimpleFeature({
    id: `feature-${data.start}`,
    data: {
      start: data.start,
      end: data.end,
      strand: data.strand ?? 1,
      CIGAR: data.CIGAR ?? `${data.end - data.start}M`,
    },
  })
}

describe('generateCoverageBins', () => {
  const region = {
    assemblyName: 'test',
    refName: 'chr1',
    start: 0,
    end: 100,
  }

  test('does not call fetchSequence when statsEstimationMode is true', async () => {
    const fetchSequence = jest.fn().mockResolvedValue('A'.repeat(102))
    const features = [
      createMockFeature({ start: 10, end: 20 }),
      createMockFeature({ start: 15, end: 25 }),
    ]

    await generateCoverageBins({
      features,
      region,
      opts: {
        colorBy: { type: 'modifications' },
        statsEstimationMode: true,
      },
      fetchSequence,
    })

    expect(fetchSequence).not.toHaveBeenCalled()
  })

  test('calls fetchSequence when statsEstimationMode is false with modifications colorBy', async () => {
    const fetchSequence = jest.fn().mockResolvedValue('A'.repeat(102))
    const features = [
      createMockFeature({ start: 10, end: 20 }),
      createMockFeature({ start: 15, end: 25 }),
    ]

    await generateCoverageBins({
      features,
      region,
      opts: {
        colorBy: { type: 'modifications' },
        statsEstimationMode: false,
      },
      fetchSequence,
    })

    expect(fetchSequence).toHaveBeenCalled()
  })

  test('does not call fetchSequence for methylation when statsEstimationMode is true', async () => {
    const fetchSequence = jest.fn().mockResolvedValue('ACGTACGT'.repeat(20))
    const features = [createMockFeature({ start: 10, end: 20 })]

    await generateCoverageBins({
      features,
      region,
      opts: {
        colorBy: { type: 'methylation' },
        statsEstimationMode: true,
      },
      fetchSequence,
    })

    expect(fetchSequence).not.toHaveBeenCalled()
  })

  test('still processes depth when statsEstimationMode is true', async () => {
    const features = [
      createMockFeature({ start: 10, end: 20 }),
      createMockFeature({ start: 15, end: 25 }),
    ]

    const result = await generateCoverageBins({
      features,
      region,
      opts: {
        statsEstimationMode: true,
      },
    })

    // Depth should still be calculated
    expect(result.bins[10]?.depth).toBe(1)
    expect(result.bins[15]?.depth).toBe(2) // overlapping region
    expect(result.bins[20]?.depth).toBe(1)
  })
})
