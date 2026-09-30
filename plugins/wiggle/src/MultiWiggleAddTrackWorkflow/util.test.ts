import PluginManager from '@jbrowse/core/PluginManager'
import { types } from '@jbrowse/mobx-state-tree'
import BedPlugin from '@jbrowse/plugin-bed'

import WigglePlugin from '../index.ts'
import {
  applyName,
  buildAdapterPayload,
  buildMultiRowTrackConf,
  canSubmit,
  classifyFile,
  classifyItem,
  itemToName,
  parseItems,
  sessionGuessers,
  stackKind,
} from './util.ts'

import type { Member } from './util.ts'

function guessers() {
  const pluginManager = new PluginManager([new BedPlugin(), new WigglePlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return sessionGuessers(types.model({}).create({}, { pluginManager }))
}

function asMember(c: ReturnType<typeof classifyItem>) {
  if ('reason' in c) {
    throw new Error(`refused: ${c.reason}`)
  }
  return c
}

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
  it('names a URL item by the basename the track will label it with', () => {
    expect(itemToName('https://example.com/x.bw')).toBe('x')
  })

  it('prefers source over name', () => {
    expect(itemToName({ source: 's', name: 'n' })).toBe('s')
  })

  it('derives the basename from the primary location in any format', () => {
    expect(
      itemToName({
        type: 'BigBedAdapter',
        bigBedLocation: { uri: 'https://host/peaks.bb' },
      }),
    ).toBe('peaks')
  })

  it('falls back to "unnamed" when neither present', () => {
    expect(itemToName({})).toBe('unnamed')
  })
})

describe('classifyItem', () => {
  it.each([
    ['https://host/a.bw', 'BigWigAdapter', 'quantitative'],
    ['https://host/a.bedgraph', 'BedGraphAdapter', 'quantitative'],
    ['https://host/a.bed', 'BedAdapter', 'feature'],
    ['https://host/a.bed.gz', 'BedTabixAdapter', 'feature'],
    ['https://host/a.bb', 'BigBedAdapter', 'feature'],
  ])('stacks %s through %s as %s', (url, type, kind) => {
    const m = asMember(classifyItem(url, guessers()))
    expect(m.conf.type).toBe(type)
    expect(m.kind).toBe(kind)
  })

  it('pairs a pasted tabix URL with its index', () => {
    const m = asMember(classifyItem('https://host/a.bed.gz', guessers()))
    expect(m.conf.index).toMatchObject({
      location: { uri: 'https://host/a.bed.gz.tbi' },
    })
  })

  it('names a file it cannot read', () => {
    expect(classifyItem('https://host/a.xyz', guessers())).toEqual({
      name: 'a',
      reason: 'not a file format JBrowse recognizes',
    })
  })

  it('refuses a format that draws as some other track type', () => {
    expect(classifyItem('https://host/a.bedpe', guessers())).toMatchObject({
      name: 'a',
      reason: expect.stringContaining('does not stack'),
    })
  })

  it('keeps a pasted config as written, classified by its type', () => {
    const conf = {
      type: 'BigBedAdapter',
      bigBedLocation: { uri: 'https://host/p.bb' },
      color: 'green',
    }
    expect(classifyItem(conf, guessers())).toEqual({
      name: 'p',
      conf,
      kind: 'feature',
    })
  })

  it('refuses a pasted config whose type no plugin registers', () => {
    expect(classifyItem({ type: 'NopeAdapter' }, guessers())).toMatchObject({
      reason: 'unknown adapter type "NopeAdapter"',
    })
  })
})

describe('classifyFile', () => {
  it('pins a dropped file its name, since a blob carries no path', () => {
    const m = asMember(
      classifyFile(new File(['data'], 'sample.txt.bw'), guessers()),
    )
    expect(m).toMatchObject({
      name: 'sample.txt',
      kind: 'quantitative',
      conf: { type: 'BigWigAdapter', source: 'sample.txt' },
    })
  })

  it('refuses a dropped file that needs an index it cannot bring', () => {
    expect(
      classifyFile(new File(['data'], 'peaks.bed.gz'), guessers()),
    ).toMatchObject({
      name: 'peaks.bed',
      reason: expect.stringContaining('index'),
    })
  })
})

describe('stackKind', () => {
  it('is the one kind every member shares', () => {
    expect(stackKind(['feature', 'feature'])).toBe('feature')
  })

  it('is mixed when quantitative and feature members meet', () => {
    expect(stackKind(['feature', 'quantitative'])).toBe('mixed')
  })

  it('is undefined with no members', () => {
    expect(stackKind([])).toBeUndefined()
  })
})

describe('canSubmit', () => {
  it('requires one kind of member', () => {
    for (const kind of [undefined, 'mixed'] as const) {
      expect(canSubmit({ kind, trackName: 'n', assembly: 'a' })).toBe(false)
    }
  })

  it('requires a non-blank track name', () => {
    expect(
      canSubmit({ kind: 'feature', trackName: '   ', assembly: 'a' }),
    ).toBe(false)
  })

  it('requires an assembly', () => {
    expect(
      canSubmit({ kind: 'feature', trackName: 'n', assembly: undefined }),
    ).toBe(false)
  })

  it('passes when all conditions are met', () => {
    expect(canSubmit({ kind: 'feature', trackName: 'n', assembly: 'a' })).toBe(
      true,
    )
  })
})

describe('buildAdapterPayload', () => {
  it('writes pasted BigWig URLs in the compact bigWigs form', () => {
    const g = guessers()
    const confs = ['https://a.bw', 'https://b.bw'].map(
      u => asMember(classifyItem(u, g)).conf,
    )
    expect(buildAdapterPayload(confs)).toEqual({
      bigWigs: ['https://a.bw', 'https://b.bw'],
    })
  })

  it('writes subadapters once any member is more than a bare BigWig URL', () => {
    const g = guessers()
    const bw = asMember(classifyItem('https://a.bw', g))
    const renamed = applyName(asMember(classifyItem('https://b.bw', g)), 'B')
    expect(buildAdapterPayload([bw.conf, renamed])).toEqual({
      subadapters: [bw.conf, renamed],
    })
  })

  it('writes feature members as subadapters', () => {
    const conf = asMember(classifyItem('https://a.bb', guessers())).conf
    expect(buildAdapterPayload([conf])).toEqual({ subadapters: [conf] })
  })
})

describe('applyName', () => {
  const m: Member = {
    name: 'a',
    kind: 'quantitative',
    conf: { type: 'BigWigAdapter', bigWigLocation: { uri: 'https://a.bw' } },
  }

  it('leaves an unedited member as it came', () => {
    expect(applyName(m, 'a')).toBe(m.conf)
  })

  it('pins an edited name as source', () => {
    expect(applyName(m, 'Sample A')).toEqual({ ...m.conf, source: 'Sample A' })
  })
})

describe('buildMultiRowTrackConf', () => {
  const args = { name: 'Peaks', assemblyNames: ['hg38'], adapter: {} }

  it('stacks quantitative members as a MultiQuantitativeTrack', () => {
    expect(
      buildMultiRowTrackConf({ ...args, kind: 'quantitative' }),
    ).toMatchObject({
      type: 'MultiQuantitativeTrack',
      adapter: { type: 'MultiWiggleAdapter' },
    })
  })

  it('paints feature members one row per file', () => {
    const conf = buildMultiRowTrackConf({ ...args, kind: 'feature' })
    expect(conf).toMatchObject({
      type: 'FeatureTrack',
      adapter: { type: 'MultiWiggleAdapter' },
      displays: [{ type: 'LinearMultiRowFeatureDisplay', rows: 'source' }],
    })
  })
})
