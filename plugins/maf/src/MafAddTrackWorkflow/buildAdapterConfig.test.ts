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
})

describe('buildAdapterConfig', () => {
  const sampleNames = ['hg38', 'mm10']

  test('BigMafAdapter', () => {
    expect(
      buildAdapterConfig({
        fileTypeChoice: 'BigMafAdapter',
        indexTypeChoice: 'TBI',
        loc,
        indexLoc: undefined,
        nhLoc,
        summaryLoc: undefined,
        sampleNames,
      }),
    ).toEqual({
      type: 'BigMafAdapter',
      bigBedLocation: loc,
      samples: sampleNames,
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
        sampleNames,
      }),
    ).toEqual({
      type: 'BigMafAdapter',
      bigBedLocation: loc,
      samples: sampleNames,
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
        sampleNames,
      }),
    ).toEqual({
      type: 'MafTabixAdapter',
      bedGzLocation: loc,
      nhLocation: nhLoc,
      index: { indexType: 'CSI', location: indexLoc },
      samples: sampleNames,
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
        sampleNames,
      }),
    ).toEqual({
      type: 'MafTabixAdapter',
      bedGzLocation: loc,
      nhLocation: nhLoc,
      index: { indexType: 'TBI', location: indexLoc },
      samples: sampleNames,
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
        sampleNames,
      }),
    ).toEqual({
      type: 'BgzipTaffyAdapter',
      tafGzLocation: loc,
      taiLocation: indexLoc,
      nhLocation: nhLoc,
      samples: sampleNames,
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
        sampleNames,
      }),
    ).toThrow(/data file/)
  })

  test('throws when tabix index missing', () => {
    expect(() =>
      buildAdapterConfig({
        fileTypeChoice: 'MafTabixAdapter',
        indexTypeChoice: 'TBI',
        loc,
        indexLoc: undefined,
        nhLoc,
        summaryLoc: undefined,
        sampleNames,
      }),
    ).toThrow(/index/)
  })

  test('throws when TAF index missing', () => {
    expect(() =>
      buildAdapterConfig({
        fileTypeChoice: 'BgzipTaffyAdapter',
        indexTypeChoice: 'TBI',
        loc,
        indexLoc: undefined,
        nhLoc,
        summaryLoc: undefined,
        sampleNames,
      }),
    ).toThrow(/index/)
  })
})
