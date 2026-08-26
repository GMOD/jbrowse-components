import {
  filterInitTracks,
  trackSkipper,
  unsupportedReason,
} from './unsupportedTracks.ts'

import type { Track } from './types.ts'

// The types this build is pretending to have registered.
const types = {
  trackTypes: {
    has: (n: string) =>
      ['FeatureTrack', 'AlignmentsTrack', 'MultiQuantitativeTrack'].includes(n),
  },
  adapterTypes: {
    has: (n: string) =>
      [
        'Gff3TabixAdapter',
        'BamAdapter',
        'BigWigAdapter',
        'MultiWiggleAdapter',
        'IndexedFastaAdapter',
      ].includes(n),
  },
}

const gff: Track = {
  trackId: 'genes',
  type: 'FeatureTrack',
  adapter: { type: 'Gff3TabixAdapter', gffGzLocation: { uri: 'g.gff.gz' } },
}

test('a track this build can build has no reason to skip it', () => {
  expect(unsupportedReason(gff, types)).toBeUndefined()
})

// The case this exists for: the JBrowse demo config's CpG island lane.
test('names the unregistered adapter type', () => {
  expect(
    unsupportedReason(
      {
        trackId: 'cpg',
        type: 'FeatureTrack',
        adapter: { type: 'UCSCAdapter' },
      },
      types,
    ),
  ).toMatch(/adapter type "UCSCAdapter"/)
})

test('names the unregistered track type', () => {
  expect(
    unsupportedReason(
      { trackId: 'msa', type: 'MsaTrack', adapter: { type: 'BamAdapter' } },
      types,
    ),
  ).toMatch(/track type "MsaTrack"/)
})

// An unregistered type inside the adapter tree fails the config exactly as the
// top-level one does, so the walk has to follow the keys that name an adapter.
test('reaches a nested subadapter', () => {
  expect(
    unsupportedReason(
      {
        trackId: 'multi',
        type: 'MultiQuantitativeTrack',
        adapter: {
          type: 'MultiWiggleAdapter',
          subadapters: [
            { type: 'BigWigAdapter' },
            { type: 'SomeoneElsesAdapter' },
          ],
        },
      },
      types,
    ),
  ).toMatch(/adapter type "SomeoneElsesAdapter"/)
})

// The false positive the restricted walk is there to avoid: a `type` that isn't
// an adapter type at all.
test('a non-adapter type field inside the adapter is not an adapter', () => {
  expect(
    unsupportedReason(
      {
        trackId: 'reads',
        type: 'AlignmentsTrack',
        adapter: {
          type: 'BamAdapter',
          index: {
            indexType: 'CSI',
            location: { locationType: 'UriLocation' },
          },
          sequenceAdapter: { type: 'IndexedFastaAdapter' },
          filters: [{ type: 'not-an-adapter' }],
        },
      },
      types,
    ),
  ).toBeUndefined()
})

test('the skipper answers per trackId and warns once each', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const skip = trackSkipper(
    [
      gff,
      {
        trackId: 'cpg',
        type: 'FeatureTrack',
        adapter: { type: 'UCSCAdapter' },
      },
    ],
    types,
  )
  expect(skip('genes')).toBe(false)
  expect(skip('cpg')).toBe(true)
  expect(skip('cpg')).toBe(true)
  // a trackId the config never had is not this module's business
  expect(skip('nonexistent')).toBe(false)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]?.[0]).toMatch(/skipping track "cpg"/)
  warn.mockRestore()
})

// Warning at the scan instead would name every unopenable track in a big
// --config; only the ones actually asked for should be reported.
test('a skippable track nobody opens says nothing', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  trackSkipper(
    [
      {
        trackId: 'cpg',
        type: 'FeatureTrack',
        adapter: { type: 'UCSCAdapter' },
      },
    ],
    types,
  )
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

describe('filterInitTracks', () => {
  const skip = (trackId: string) => trackId === 'cpg'

  test('drops bare ids and display-snapshot entries alike', () => {
    expect(
      filterInitTracks(
        ['cpg', 'genes', { trackId: 'cpg', height: 40 }, { trackId: 'reads' }],
        skip,
      ),
    ).toEqual(['genes', { trackId: 'reads' }])
  })

  test("reaches into a comparative view's per-level lists", () => {
    expect(filterInitTracks([['cpg', 'paf1'], ['genes']], skip)).toEqual([
      ['paf1'],
      ['genes'],
    ])
  })

  test('a view init with no tracks list is untouched', () => {
    const init: { tracks?: string[] } = {}
    expect(filterInitTracks(init.tracks, skip)).toBeUndefined()
  })
})
