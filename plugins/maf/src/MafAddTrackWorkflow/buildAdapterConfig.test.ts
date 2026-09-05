import { buildAdapterConfig, parseSampleNames } from './buildAdapterConfig.ts'

import type { FileLocation } from '@jbrowse/core/util'

const loc: FileLocation = { uri: 'data.bb', locationType: 'UriLocation' }
const indexLoc: FileLocation = { uri: 'data.tbi', locationType: 'UriLocation' }
const nhLoc: FileLocation = { uri: 'tree.nh', locationType: 'UriLocation' }
const summaryLoc: FileLocation = {
  uri: 'data.summary.bb',
  locationType: 'UriLocation',
}

describe('parseSampleNames', () => {
  test('one name per line, trimmed and blanks dropped', () => {
    expect(parseSampleNames('hg38\n  mm10  \n\npanTro6\n')).toEqual([
      'hg38',
      'mm10',
      'panTro6',
    ])
  })

  test('handles CRLF and CR line endings', () => {
    expect(parseSampleNames('hg38\r\nmm10\rpanTro6')).toEqual([
      'hg38',
      'mm10',
      'panTro6',
    ])
  })

  test('JSON array input, trimmed and blanks dropped', () => {
    expect(parseSampleNames('["hg38", " mm10 ", ""]')).toEqual(['hg38', 'mm10'])
  })

  test('bare JSON value falls through to line split', () => {
    expect(parseSampleNames('123')).toEqual(['123'])
  })

  test('empty input returns empty array', () => {
    expect(parseSampleNames('')).toEqual([])
  })

  // The placeholder invites "JSON formatted array of samples" and every
  // adapter's `samples` slot takes these objects, but each one used to go
  // through `String()` — so the config got the literal text `[object Object]`
  // as an id, and the track drew that many unnamed rows.
  test('JSON array of sample objects passes through', () => {
    expect(
      parseSampleNames(
        '[{"id":"hg38","label":"Human","color":"red"},{"id":"mm10","assemblyName":"mm10"}]',
      ),
    ).toEqual([
      { id: 'hg38', label: 'Human', color: 'red' },
      { id: 'mm10', assemblyName: 'mm10' },
    ])
  })

  // Left mixed rather than homogenized: `normalizeSamples` reads each entry on
  // its own, so this is both what the user typed and what the adapter takes.
  test('a mixed array keeps both forms', () => {
    expect(parseSampleNames('["hg38", {"id":"mm10","label":"Mouse"}]')).toEqual(
      ['hg38', { id: 'mm10', label: 'Mouse' }],
    )
  })
})

describe('buildAdapterConfig', () => {
  const samples = ['hg38', 'mm10']

  test('BigMafAdapter', () => {
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'BigMafAdapter',
        indexTypeChoice: 'TBI',
        loc,
        indexLoc: undefined,
        nhLoc,
        summaryLoc: undefined,
        framesLoc: undefined,
        samples,
      }),
    ).toEqual({
      type: 'BigMafAdapter',
      bigBedLocation: loc,
      samples,
      nhLocation: nhLoc,
    })
  })

  test('BigMafAdapter with summary emits swappable summaryAdapter', () => {
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'BigMafAdapter',
        indexTypeChoice: 'TBI',
        loc,
        indexLoc: undefined,
        nhLoc,
        summaryLoc,
        framesLoc: undefined,
        samples,
      }),
    ).toEqual({
      type: 'BigMafAdapter',
      bigBedLocation: loc,
      samples,
      nhLocation: nhLoc,
      summaryAdapter: {
        type: 'BigBedAdapter',
        bigBedLocation: summaryLoc,
      },
    })
  })

  test('MafTabixAdapter carries index type', () => {
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'MafTabixAdapter',
        indexTypeChoice: 'CSI',
        loc,
        indexLoc,
        nhLoc,
        summaryLoc: undefined,
        framesLoc: undefined,
        samples,
      }),
    ).toEqual({
      type: 'MafTabixAdapter',
      bedGzLocation: loc,
      nhLocation: nhLoc,
      index: { indexType: 'CSI', location: indexLoc },
      samples,
    })
  })

  // The two branches that used to refuse to build without a picker. Both
  // adapters' own `uri` shorthands resolve exactly these siblings, and the form
  // already derives the summary BED's `.tbi` two fields down.
  test('MafTabixAdapter derives the sibling index, following the radio', () => {
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'MafTabixAdapter',
        indexTypeChoice: 'CSI',
        loc,
        indexLoc: undefined,
        nhLoc,
        summaryLoc: undefined,
        framesLoc: undefined,
        samples,
      }),
    ).toMatchObject({
      index: {
        indexType: 'CSI',
        location: { uri: 'data.bb.csi', locationType: 'UriLocation' },
      },
    })
  })

  test('BgzipTaffyAdapter derives the sibling .tai', () => {
    const tafGz: FileLocation = {
      uri: 'aln.taf.gz',
      locationType: 'UriLocation',
    }
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'BgzipTaffyAdapter',
        indexTypeChoice: 'TBI',
        loc: tafGz,
        indexLoc: undefined,
        nhLoc,
        summaryLoc: undefined,
        framesLoc: undefined,
        samples,
      }),
    ).toMatchObject({
      taiLocation: { uri: 'aln.taf.gz.tai', locationType: 'UriLocation' },
    })
  })

  // The tabix adapter is the one that most needs a summary — every species'
  // bases ride on one BED line, so a wide query pulls the whole alignment and
  // the size gate blocks it, leaving the track with no zoom-out view. The form
  // had a summary field all along but only wired it for BigMaf, so a tabix user
  // who filled it in got a track that silently ignored the file.
  test('MafTabixAdapter with summary emits a BedTabix summaryAdapter', () => {
    const summaryBed: FileLocation = {
      uri: 'data.summary.bed.gz',
      locationType: 'UriLocation',
    }
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'MafTabixAdapter',
        indexTypeChoice: 'TBI',
        loc,
        indexLoc,
        nhLoc,
        summaryLoc: summaryBed,
        framesLoc: undefined,
        samples,
      }),
    ).toEqual({
      type: 'MafTabixAdapter',
      bedGzLocation: loc,
      nhLocation: nhLoc,
      index: { indexType: 'TBI', location: indexLoc },
      samples,
      summaryAdapter: {
        type: 'BedTabixAdapter',
        bedGzLocation: summaryBed,
        // derived, not asked for — the same sibling-suffix assumption both
        // this adapter's and BedTabixAdapter's `uri` shorthands already make
        index: {
          location: {
            uri: 'data.summary.bed.gz.tbi',
            locationType: 'UriLocation',
          },
        },
      },
    })
  })

  test('BgzipTaffyAdapter', () => {
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'BgzipTaffyAdapter',
        indexTypeChoice: 'TBI',
        loc,
        indexLoc,
        nhLoc,
        summaryLoc: undefined,
        framesLoc: undefined,
        samples,
      }),
    ).toEqual({
      type: 'BgzipTaffyAdapter',
      tafGzLocation: loc,
      taiLocation: indexLoc,
      nhLocation: nhLoc,
      samples,
    })
  })

  // TAF was the one type the form's summary field stayed hidden for, on the
  // grounds that a `.tai` bounds a read to the span on screen. It does, and the
  // other factor is depth: at HPRC's 464 haplotypes a span-bounded read is still
  // ~2 compressed bytes per bp, so there is a zoom past which no index helps —
  // chr6 whole is 354 MB.
  test('BgzipTaffyAdapter with summary emits a BedTabix summaryAdapter', () => {
    const summaryBed: FileLocation = {
      uri: 'data.summary.bed.gz',
      locationType: 'UriLocation',
    }
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'BgzipTaffyAdapter',
        indexTypeChoice: 'TBI',
        loc,
        indexLoc,
        nhLoc,
        summaryLoc: summaryBed,
        framesLoc: undefined,
        samples,
      }),
    ).toEqual({
      type: 'BgzipTaffyAdapter',
      tafGzLocation: loc,
      taiLocation: indexLoc,
      nhLocation: nhLoc,
      samples,
      summaryAdapter: {
        type: 'BedTabixAdapter',
        bedGzLocation: summaryBed,
        index: {
          location: {
            uri: 'data.summary.bed.gz.tbi',
            locationType: 'UriLocation',
          },
        },
      },
    })
  })

  // The format whole-genome alignments are actually published in — HPRC
  // release 2 ships a 53 GB `.maf.gz` with a sibling `.tai`. The adapter has
  // been registered since it was written; the form just offered no way to reach
  // it, so an HPRC alignment had to be converted first.
  test('BgzipMafAdapter derives the sibling .tai', () => {
    const mafGz: FileLocation = {
      uri: 'aln.maf.gz',
      locationType: 'UriLocation',
    }
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'BgzipMafAdapter',
        indexTypeChoice: 'TBI',
        loc: mafGz,
        indexLoc: undefined,
        nhLoc,
        summaryLoc: undefined,
        framesLoc: undefined,
        samples,
      }),
    ).toEqual({
      type: 'BgzipMafAdapter',
      mafGzLocation: mafGz,
      // not asked for — the adapter's own `uri` shorthand assumes the same
      // sibling, so a published pair needs no second picker
      taiLocation: { uri: 'aln.maf.gz.tai', locationType: 'UriLocation' },
      nhLocation: nhLoc,
      samples,
    })
  })

  test('BgzipMafAdapter prefers an explicitly supplied .tai', () => {
    const mafGz: FileLocation = {
      uri: 'aln.maf.gz',
      locationType: 'UriLocation',
    }
    const tai: FileLocation = {
      uri: 'elsewhere/aln.tai',
      locationType: 'UriLocation',
    }
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'BgzipMafAdapter',
        indexTypeChoice: 'TBI',
        loc: mafGz,
        indexLoc: tai,
        nhLoc,
        summaryLoc: undefined,
        framesLoc: undefined,
        samples,
      }),
    ).toMatchObject({ taiLocation: tai })
  })

  // The CDS frames gate three separate features — the frame strip, the codon
  // row coloring and the codon conservation band — and the form had no field
  // for them at all, so none of the three was reachable from a UI-added track.
  test.each([
    'BigMafAdapter',
    'MafTabixAdapter',
    'BgzipTaffyAdapter',
    'BgzipMafAdapter',
  ] as const)('%s carries a frames annotationAdapter', fileTypeChoice => {
    const framesLoc: FileLocation = {
      uri: 'multiz30wayFrames.bb',
      locationType: 'UriLocation',
    }
    expect(
      buildAdapterConfig({
        fileTypeChoice,
        indexTypeChoice: 'TBI',
        loc,
        indexLoc,
        nhLoc,
        summaryLoc: undefined,
        framesLoc,
        samples,
      }),
    ).toMatchObject({
      annotationAdapter: {
        type: 'BigBedAdapter',
        bigBedLocation: framesLoc,
      },
    })
  })

  test('throws when data file missing', () => {
    expect(() =>
      buildAdapterConfig({
        fileTypeChoice: 'BigMafAdapter',
        indexTypeChoice: 'TBI',
        loc: undefined,
        indexLoc,
        nhLoc,
        summaryLoc: undefined,
        framesLoc: undefined,
        samples,
      }),
    ).toThrow(/data file/)
  })
})
