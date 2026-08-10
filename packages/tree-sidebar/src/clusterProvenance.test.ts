import {
  clusterProvenanceDrifted,
  clusterProvenanceFromRegions,
  clusterProvenanceLocLabel,
  clusterProvenanceOverlap,
  describeClusterProvenance,
} from './clusterProvenance.ts'

const ctgA = (start: number, end: number) => ({ refName: 'ctgA', start, end })

test('keeps only the fields that describe the locus', () => {
  const provenance = clusterProvenanceFromRegions([
    {
      refName: 'ctgA',
      start: 0,
      end: 100,
      assemblyName: 'volvox',
      // extra block fields (keys, offsets, widths) must not reach the snapshot
      key: 'ctgA-0-100',
      offsetPx: 12,
      widthPx: 800,
    },
  ])
  expect(provenance.regions).toEqual([
    { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
  ])
  expect(provenance.settings).toBeUndefined()
})

describe('labels', () => {
  test('a single region reads as a locstring', () => {
    expect(
      clusterProvenanceLocLabel(clusterProvenanceFromRegions([ctgA(0, 100)])),
    ).toBe('ctgA:1..100')
  })

  test('multiple regions name the first and count the rest', () => {
    expect(
      clusterProvenanceLocLabel(
        clusterProvenanceFromRegions([ctgA(0, 100), ctgA(500, 600)]),
      ),
    ).toBe('ctgA:1..100 +1 more')
  })

  test('the caption carries the settings that changed the matrix', () => {
    expect(
      describeClusterProvenance(
        clusterProvenanceFromRegions(
          [ctgA(0, 100)],
          [{ name: 'MAF filter', value: '0.05' }],
        ),
      ),
    ).toBe('Clustered on ctgA:1..100 · MAF filter: 0.05')
  })
})

describe('drift', () => {
  const provenance = clusterProvenanceFromRegions([ctgA(1000, 2000)])

  test('staying put is not drift', () => {
    expect(clusterProvenanceOverlap(provenance, [ctgA(1000, 2000)])).toBe(1)
    expect(clusterProvenanceDrifted(provenance, [ctgA(1000, 2000)])).toBe(false)
  })

  // The reason this is an overlap fraction and not an equality test: blocks
  // shift by a sub-bp amount on any pan or zoom, and a warning that fires on
  // every nudge is one readers stop seeing.
  test('a nudge or a zoom-out is not drift', () => {
    expect(clusterProvenanceDrifted(provenance, [ctgA(1001, 2001)])).toBe(false)
    expect(clusterProvenanceDrifted(provenance, [ctgA(0, 5000)])).toBe(false)
  })

  test('panning most of the way off the clustered region is drift', () => {
    expect(
      clusterProvenanceOverlap(provenance, [ctgA(1800, 3000)]),
    ).toBeCloseTo(0.2)
    expect(clusterProvenanceDrifted(provenance, [ctgA(1800, 3000)])).toBe(true)
  })

  test('another chromosome is drift, whatever the coordinates', () => {
    expect(
      clusterProvenanceOverlap(provenance, [
        { refName: 'ctgB', start: 1000, end: 2000 },
      ]),
    ).toBe(0)
    expect(
      clusterProvenanceDrifted(provenance, [
        { refName: 'ctgB', start: 1000, end: 2000 },
      ]),
    ).toBe(true)
  })

  test('the same refName in another assembly is drift', () => {
    const onVolvox = clusterProvenanceFromRegions([
      { refName: 'chr1', start: 0, end: 100, assemblyName: 'volvox' },
    ])
    expect(
      clusterProvenanceDrifted(onVolvox, [
        { refName: 'chr1', start: 0, end: 100, assemblyName: 'other' },
      ]),
    ).toBe(true)
    // but a region that names no assembly still matches, so a session saved
    // before the field existed doesn't report drift everywhere
    expect(
      clusterProvenanceDrifted(onVolvox, [
        { refName: 'chr1', start: 0, end: 100 },
      ]),
    ).toBe(false)
  })

  test('the label leaves the assembly out, since the caption sits inside one view', () => {
    expect(
      clusterProvenanceLocLabel(
        clusterProvenanceFromRegions([
          { refName: 'ctgA', start: 0, end: 50000, assemblyName: 'volvox' },
        ]),
      ),
    ).toBe('ctgA:1..50,000')
  })

  test('an empty view is drift rather than a divide-by-zero', () => {
    expect(clusterProvenanceOverlap(provenance, [])).toBe(0)
    expect(clusterProvenanceDrifted(provenance, [])).toBe(true)
  })

  test('several blocks covering the clustered span together do not drift', () => {
    // a collapsed-intron or multi-region view: neither block covers half on its
    // own, but between them the clustered region is still on screen
    expect(
      clusterProvenanceOverlap(provenance, [
        ctgA(1000, 1400),
        ctgA(1400, 1900),
      ]),
    ).toBeCloseTo(0.9)
    expect(
      clusterProvenanceDrifted(provenance, [
        ctgA(1000, 1400),
        ctgA(1400, 1900),
      ]),
    ).toBe(false)
  })

  test('overlap is capped at 1 even if a caller passes overlapping regions', () => {
    expect(
      clusterProvenanceOverlap(provenance, [
        ctgA(1000, 2000),
        ctgA(1000, 2000),
      ]),
    ).toBe(1)
  })
})
