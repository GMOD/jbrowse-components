import { splitRegionByCds, splitString, transcriptRegions } from './util.ts'

describe('transcriptRegions', () => {
  test('uses the exons when the transcript has them', () => {
    const exons = [
      { start: 0, end: 100 },
      { start: 200, end: 300 },
    ]
    expect(
      transcriptRegions({
        cds: [{ start: 50, end: 250 }],
        exons,
        featureLength: 300,
      }),
    ).toBe(exons)
  })

  test('stands the CDS blocks in for missing exons, stretched to the bounds', () => {
    // the flanking UTRs are only reachable by stretching the outermost blocks
    expect(
      transcriptRegions({
        cds: [
          { start: 100, end: 200 },
          { start: 250, end: 350 },
        ],
        exons: [],
        featureLength: 400,
      }),
    ).toStrictEqual([
      { start: 0, end: 200 },
      { start: 250, end: 400 },
    ])
  })

  test('a single CDS block with no exons spans the whole feature', () => {
    expect(
      transcriptRegions({
        cds: [{ start: 100, end: 300 }],
        exons: [],
        featureLength: 400,
      }),
    ).toStrictEqual([{ start: 0, end: 400 }])
  })

  test('nothing to render without exons or CDS', () => {
    expect(
      transcriptRegions({ cds: [], exons: [], featureLength: 400 }),
    ).toStrictEqual([])
  })
})

describe('splitRegionByCds', () => {
  test('splits an exon into UTR/CDS/UTR', () => {
    expect(
      splitRegionByCds({ start: 0, end: 400 }, [{ start: 100, end: 300 }]),
    ).toStrictEqual([
      { start: 0, end: 100, isCds: false },
      { start: 100, end: 300, isCds: true },
      { start: 300, end: 400, isCds: false },
    ])
  })

  test('handles several CDS blocks inside one region', () => {
    expect(
      splitRegionByCds({ start: 0, end: 400 }, [
        { start: 100, end: 200 },
        { start: 200, end: 300 },
      ]),
    ).toStrictEqual([
      { start: 0, end: 100, isCds: false },
      { start: 100, end: 200, isCds: true },
      { start: 200, end: 300, isCds: true },
      { start: 300, end: 400, isCds: false },
    ])
  })

  test('clips a CDS that overruns the region', () => {
    expect(
      splitRegionByCds({ start: 100, end: 200 }, [{ start: 0, end: 300 }]),
    ).toStrictEqual([{ start: 100, end: 200, isCds: true }])
  })

  test('a non-overlapping CDS leaves the region untranslated', () => {
    expect(
      splitRegionByCds({ start: 0, end: 100 }, [{ start: 200, end: 300 }]),
    ).toStrictEqual([{ start: 0, end: 100, isCds: false }])
  })

  test('a fully coding region yields one CDS part', () => {
    expect(
      splitRegionByCds({ start: 0, end: 100 }, [{ start: 0, end: 100 }]),
    ).toStrictEqual([{ start: 0, end: 100, isCds: true }])
  })
})

describe('splitString', () => {
  test('splits a string into rows of charactersPerRow', () => {
    const { segments } = splitString({
      str: 'AAACCCGGGTTT',
      charactersPerRow: 4,
      showCoordinates: false,
    })
    expect(segments).toStrictEqual(['AAAC', 'CCGG', 'GTTT'])
  })

  test('handles string shorter than one row', () => {
    const { segments } = splitString({
      str: 'ACG',
      charactersPerRow: 10,
      showCoordinates: false,
    })
    expect(segments).toStrictEqual(['ACG'])
  })

  test('returns correct remainder when string fills rows exactly', () => {
    const { remainder } = splitString({
      str: 'ACGTACGT',
      charactersPerRow: 4,
      showCoordinates: false,
    })
    expect(remainder).toBe(0)
  })

  test('returns correct remainder for partial last row', () => {
    const { remainder } = splitString({
      str: 'ACGTA',
      charactersPerRow: 4,
      showCoordinates: false,
    })
    expect(remainder).toBe(1)
  })

  test('respects currRemainder when splitting across sections', () => {
    // 2 chars already in current row, row width 4
    // 'ACGT' should fill 2 more chars (completing row), then start a new row
    const { segments, remainder } = splitString({
      str: 'ACGT',
      charactersPerRow: 4,
      showCoordinates: false,
      currRemainder: 2,
    })
    expect(segments).toHaveLength(2)
    expect(segments[0]).toBe('AC') // completes the current row (2 already placed)
    expect(segments[1]).toBe('GT') // new row
    expect(remainder).toBe(2)
  })

  test('currRemainder of 0 produces normal full-width first chunk', () => {
    const { segments } = splitString({
      str: 'ACGTACGT',
      charactersPerRow: 4,
      showCoordinates: false,
      currRemainder: 0,
    })
    expect(segments[0]).toBe('ACGT')
  })

  test('adds coordinate spaces when showCoordinates is true', () => {
    const { segments } = splitString({
      str: 'AAAAAAAAAA', // 10 chars, spacingInterval=10
      charactersPerRow: 20,
      showCoordinates: true,
      spacingInterval: 5,
    })
    // every 5 chars a space should be inserted
    expect(segments[0]).toContain(' ')
  })

  test('spaces a segment continuing a row mid-spacing-group', () => {
    // 15 chars already on the row, so this segment's first char is column 15
    // and the next separator belongs 5 chars in, at column 20
    const { segments } = splitString({
      str: 'BBBBBBBBBB',
      charactersPerRow: 100,
      showCoordinates: true,
      currRemainder: 15,
    })
    expect(segments).toStrictEqual(['BBBBB BBBBB'])
  })

  test('spaces a segment starting exactly on a spacing boundary', () => {
    // 20 chars already on the row: column 20 is a separator position, so the
    // segment leads with a space rather than gluing onto the previous segment
    const { segments } = splitString({
      str: 'BBBBBBBBBB',
      charactersPerRow: 100,
      showCoordinates: true,
      currRemainder: 20,
    })
    expect(segments).toStrictEqual([' BBBBBBBBBB'])
  })

  test('empty string returns empty segments and zero remainder', () => {
    const { segments, remainder } = splitString({
      str: '',
      charactersPerRow: 10,
      showCoordinates: false,
    })
    expect(segments).toHaveLength(0)
    expect(remainder).toBe(0)
  })

  test('empty string with nonzero currRemainder carries it through', () => {
    const { segments, remainder } = splitString({
      str: '',
      charactersPerRow: 10,
      showCoordinates: false,
      currRemainder: 3,
    })
    expect(segments).toHaveLength(0)
    expect(remainder).toBe(3)
  })

  test('first chunk smaller than charactersPerRow when currRemainder set', () => {
    const { segments } = splitString({
      str: 'ABCDEFGH',
      charactersPerRow: 4,
      showCoordinates: false,
      currRemainder: 1,
    })
    expect(segments[0]).toBe('ABC')
    expect(segments[1]).toBe('DEFG')
    expect(segments[2]).toBe('H')
  })
})
