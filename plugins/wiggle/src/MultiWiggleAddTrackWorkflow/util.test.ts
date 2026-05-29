import {
  applyName,
  buildAdapterPayload,
  canSubmit,
  itemToName,
  makeTrackId,
  parseItems,
  urlToSubadapter,
} from './util.ts'

describe('parseItems', () => {
  it('parses a JSON array of subadapter objects', () => {
    const json = '[{"type":"BigWigAdapter","source":"a"}]'
    expect(parseItems(json)).toEqual([{ type: 'BigWigAdapter', source: 'a' }])
  })

  it('falls back to line-split for non-JSON input', () => {
    expect(parseItems('http://a.bw\nhttp://b.bw')).toEqual([
      'http://a.bw',
      'http://b.bw',
    ])
  })

  it('falls back to line-split when JSON parses to a non-array', () => {
    expect(parseItems('"http://a.bw"')).toEqual(['"http://a.bw"'])
    expect(parseItems('{"foo":1}')).toEqual(['{"foo":1}'])
  })

  it('handles mixed CR/LF line endings and trims blanks', () => {
    expect(parseItems('a\r\n\nb\r  c  \n')).toEqual(['a', 'b', 'c'])
  })
})

describe('itemToName', () => {
  it('uses the string itself for URL items', () => {
    expect(itemToName('http://example.com/x.bw')).toBe(
      'http://example.com/x.bw',
    )
  })

  it('prefers source over name', () => {
    expect(itemToName({ source: 's', name: 'n' })).toBe('s')
  })

  it('falls back to name when source absent', () => {
    expect(itemToName({ name: 'n' })).toBe('n')
  })

  it('falls back to "unnamed" when neither present', () => {
    expect(itemToName({})).toBe('unnamed')
  })
})

describe('makeTrackId', () => {
  it('lowercases, trims, and underscores spaces', () => {
    expect(makeTrackId('  My Track  ', true)).toMatch(/^my_track-\d+$/)
  })

  it('appends -sessionTrack when not in admin mode', () => {
    expect(makeTrackId('x', false)).toMatch(/^x-\d+-sessionTrack$/)
  })
})

describe('canSubmit', () => {
  const tracks = [{}]

  it('requires at least one track', () => {
    expect(canSubmit({ tracks: [], trackName: 'n', assembly: 'a' })).toBe(false)
  })

  it('requires a non-blank track name', () => {
    expect(canSubmit({ tracks, trackName: '   ', assembly: 'a' })).toBe(false)
  })

  it('requires an assembly', () => {
    expect(canSubmit({ tracks, trackName: 'n', assembly: undefined })).toBe(
      false,
    )
  })

  it('passes when all conditions are met', () => {
    expect(canSubmit({ tracks, trackName: 'n', assembly: 'a' })).toBe(true)
  })
})

describe('buildAdapterPayload', () => {
  it('uses bigWigs shortcut when all items are URL strings', () => {
    expect(buildAdapterPayload(['http://a.bw', 'http://b.bw'])).toEqual({
      bigWigs: ['http://a.bw', 'http://b.bw'],
    })
  })

  it('uses subadapters when all items are objects', () => {
    const objs = [
      { type: 'BigWigAdapter', source: 'a' },
      { type: 'BigWigAdapter', source: 'b' },
    ]
    expect(buildAdapterPayload(objs)).toEqual({ subadapters: objs })
  })

  it('normalizes URL strings into BigWigAdapter objects when items are mixed', () => {
    const obj = { type: 'BigWigAdapter', source: 'b' }
    expect(buildAdapterPayload(['http://a.bw', obj])).toEqual({
      subadapters: [urlToSubadapter('http://a.bw'), obj],
    })
  })
})

describe('applyName', () => {
  it('keeps an unchanged URL string bare to preserve the bigWigs form', () => {
    expect(applyName('http://a.bw', 'http://a.bw')).toBe('http://a.bw')
  })

  it('promotes a renamed URL string into a BigWigAdapter with the new source', () => {
    expect(applyName('http://a.bw', 'My sample')).toEqual(
      urlToSubadapter('http://a.bw', 'My sample'),
    )
  })

  it('overrides the source of an object item', () => {
    expect(applyName({ type: 'BigWigAdapter', source: 'old' }, 'new')).toEqual({
      type: 'BigWigAdapter',
      source: 'new',
    })
  })

  it('renamed items flow through buildAdapterPayload as subadapters', () => {
    const items = [
      applyName('http://a.bw', 'Sample A'),
      applyName('http://b.bw', 'http://b.bw'),
    ]
    expect(buildAdapterPayload(items)).toEqual({
      subadapters: [
        urlToSubadapter('http://a.bw', 'Sample A'),
        urlToSubadapter('http://b.bw'),
      ],
    })
  })
})
