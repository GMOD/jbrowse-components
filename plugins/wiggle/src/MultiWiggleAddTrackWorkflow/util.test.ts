import {
  applyName,
  buildAdapterPayload,
  canSubmit,
  fileToTrackItem,
  itemToName,
  parseItems,
  urlToSubadapter,
} from './util.ts'

describe('parseItems', () => {
  it('parses a JSON array of subadapter objects', () => {
    const json = '[{"type":"BigWigAdapter","source":"a"}]'
    expect(parseItems(json)).toEqual([{ type: 'BigWigAdapter', source: 'a' }])
  })

  it('falls back to line-split for non-JSON input', () => {
    expect(parseItems('https://a.bw\nhttp://b.bw')).toEqual([
      'https://a.bw',
      'http://b.bw',
    ])
  })

  it('falls back to line-split when JSON parses to a bare string', () => {
    expect(parseItems('"https://a.bw"')).toEqual(['"https://a.bw"'])
  })

  it('wraps a single JSON object as one subadapter config', () => {
    expect(parseItems('{"type":"BigWigAdapter","source":"a"}')).toEqual([
      { type: 'BigWigAdapter', source: 'a' },
    ])
  })

  it('handles mixed CR/LF line endings and trims blanks', () => {
    expect(parseItems('a\r\n\nb\r  c  \n')).toEqual(['a', 'b', 'c'])
  })
})

describe('itemToName', () => {
  it('uses the string itself for URL items', () => {
    expect(itemToName('https://example.com/x.bw')).toBe(
      'https://example.com/x.bw',
    )
  })

  it('prefers source over name', () => {
    expect(itemToName({ source: 's', name: 'n' })).toBe('s')
  })

  it('falls back to name when source absent', () => {
    expect(itemToName({ name: 'n' })).toBe('n')
  })

  it('derives the basename from bigWigLocation when source/name absent', () => {
    expect(
      itemToName({
        type: 'BigWigAdapter',
        bigWigLocation: { uri: 'https://host/real.bw' },
      }),
    ).toBe('real')
  })

  it('falls back to "unnamed" when neither present', () => {
    expect(itemToName({})).toBe('unnamed')
  })
})

describe('fileToTrackItem', () => {
  it('strips the extension, matching a pasted URL with the same basename', () => {
    const item = fileToTrackItem(new File(['data'], 'sample.bw'))
    expect(item).toMatchObject({
      type: 'BigWigAdapter',
      source: 'sample',
    })
  })

  it('only strips the last extension', () => {
    const item = fileToTrackItem(new File(['data'], 'sample.txt.bw'))
    expect(item).toMatchObject({
      source: 'sample.txt',
    })
  })
})

describe('canSubmit', () => {
  const tracks = [{}]

  it('requires at least one track', () => {
    expect(canSubmit({ tracks: [], trackName: 'n', assembly: 'a' })).toBe(false)
  })

  it('requires a non-blank track name', () => {
    expect(canSubmit({ tracks, trackName: ' '.repeat(3), assembly: 'a' })).toBe(
      false,
    )
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

describe('urlToSubadapter', () => {
  it('omits source for a bare URL so the adapter derives the basename', () => {
    expect(urlToSubadapter('https://host/a.bw')).toEqual({
      type: 'BigWigAdapter',
      bigWigLocation: { uri: 'https://host/a.bw' },
    })
  })

  it('pins an explicit source when renamed', () => {
    expect(urlToSubadapter('https://host/a.bw', 'My sample')).toEqual({
      type: 'BigWigAdapter',
      bigWigLocation: { uri: 'https://host/a.bw' },
      source: 'My sample',
    })
  })
})

describe('buildAdapterPayload', () => {
  it('uses bigWigs shortcut when all items are URL strings', () => {
    expect(buildAdapterPayload(['https://a.bw', 'https://b.bw'])).toEqual({
      bigWigs: ['https://a.bw', 'https://b.bw'],
    })
  })

  it('uses subadapters when all items are objects', () => {
    const objs = [
      { type: 'BigWigAdapter', source: 'a' },
      { type: 'BigWigAdapter', source: 'b' },
    ]
    expect(buildAdapterPayload(objs)).toEqual({ subadapters: objs })
  })

  it('normalizes URL strings into source-less BigWigAdapter objects when items are mixed', () => {
    const obj = { type: 'BigWigAdapter', source: 'b' }
    expect(buildAdapterPayload(['https://a.bw', obj])).toEqual({
      subadapters: [
        { type: 'BigWigAdapter', bigWigLocation: { uri: 'https://a.bw' } },
        obj,
      ],
    })
  })
})

describe('applyName', () => {
  it('keeps an unchanged URL string bare to preserve the bigWigs form', () => {
    expect(applyName('https://a.bw', 'https://a.bw')).toBe('https://a.bw')
  })

  it('promotes a renamed URL string into a BigWigAdapter with the new source', () => {
    expect(applyName('https://a.bw', 'My sample')).toEqual(
      urlToSubadapter('https://a.bw', 'My sample'),
    )
  })

  it('overrides the source of an object item', () => {
    expect(applyName({ type: 'BigWigAdapter', source: 'old' }, 'new')).toEqual({
      type: 'BigWigAdapter',
      source: 'new',
    })
  })

  it('leaves an unedited source-less object untouched so the adapter derives the name', () => {
    const item = {
      type: 'BigWigAdapter',
      bigWigLocation: { uri: 'https://host/real.bw' },
    }
    expect(applyName(item, itemToName(item))).toBe(item)
    expect(buildAdapterPayload([applyName(item, itemToName(item))])).toEqual({
      subadapters: [item],
    })
  })

  it('renamed items flow through buildAdapterPayload as subadapters', () => {
    const items = [
      applyName('https://a.bw', 'Sample A'),
      applyName('https://b.bw', 'https://b.bw'),
    ]
    expect(buildAdapterPayload(items)).toEqual({
      subadapters: [
        urlToSubadapter('https://a.bw', 'Sample A'),
        urlToSubadapter('https://b.bw'),
      ],
    })
  })
})
