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
