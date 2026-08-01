import {
  guessTrack,
  guessTrackType,
  makeLocationProtocol,
} from './adapter-utils.ts'

const mapLocation = makeLocationProtocol('uri')

const guess = (location: string) =>
  guessTrack({ location, mapLocation }).adapter

describe('guessTrack', () => {
  // The CLI keeps its own guesser table, which had drifted from the browser's
  // adapter guessers. These are the cases where they disagreed.
  it('routes a bgzipped gtf to the tabix adapter, matching the browser', () => {
    expect(guess('volvox.gtf.gz')).toMatchObject({
      type: 'GtfTabixAdapter',
      gtfGzLocation: { uri: 'volvox.gtf.gz' },
      index: { indexType: 'TBI' },
    })
  })

  it('still routes a plain gtf to the whole-file adapter', () => {
    expect(guess('volvox.gtf')).toMatchObject({
      type: 'GtfAdapter',
      gtfLocation: { uri: 'volvox.gtf' },
    })
  })

  it('recognizes bedGraph, indexed and plain', () => {
    expect(guess('volvox.bg.gz')).toMatchObject({
      type: 'BedGraphTabixAdapter',
      bedGraphGzLocation: { uri: 'volvox.bg.gz' },
    })
    expect(guess('volvox.bg')).toMatchObject({
      type: 'BedGraphAdapter',
      bedGraphLocation: { uri: 'volvox.bg' },
    })
  })

  it('gives bedGraph a QuantitativeTrack, as the browser does', () => {
    expect(guessTrackType('BedGraphAdapter')).toBe('QuantitativeTrack')
    expect(guessTrackType('BedGraphTabixAdapter')).toBe('QuantitativeTrack')
  })
})
