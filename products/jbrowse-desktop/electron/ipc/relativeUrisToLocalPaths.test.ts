import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { relativeUrisToLocalPaths } from './relativeUrisToLocalPaths.ts'

const dir = path.resolve('/home/u/project')
const abs = (p: string) => path.resolve(dir, p)
const base = pathToFileURL(`${dir}${path.sep}`).href

// relativeUrisToLocalPaths rewrites a plain JSON tree in place, so a fixture's
// inferred literal type doesn't describe what it holds afterwards. Naming the
// keys the rewrite can add lets the assertions read them back.
interface Loc {
  type?: string
  name?: string
  uri?: string
  baseUri?: string
  localPath?: string
  locationType?: string
  index?: { location: Loc }
}

test('a bare relative uri on a location node becomes a localPath', () => {
  const cfg = { adapter: { type: 'BamAdapter', bamLocation: { uri: 'x.bam' } } }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg.adapter.bamLocation).toEqual({
    localPath: abs('x.bam'),
    locationType: 'LocalPathLocation',
  })
})

// regression: the rewrite used to fire on the adapter itself, deleting the `uri`
// that normalizeSnapshot keys on. The adapter kept its type and lost its file —
// bamLocation fell back to the schema default and the track drew nothing, with
// nothing logged.
test('an adapter shorthand keeps its uri and gains the config dir as baseUri', () => {
  const cfg: { adapter: Loc } = {
    adapter: { type: 'BamAdapter', uri: 'sample.bam' },
  }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg.adapter).toEqual({
    type: 'BamAdapter',
    uri: 'sample.bam',
    baseUri: base,
  })
  expect(new URL(cfg.adapter.uri!, cfg.adapter.baseUri).href).toBe(
    pathToFileURL(abs('sample.bam')).href,
  )
})

// the flat `{ name, uri }` assembly form, and the `sequence.adapter` form whose
// type is left to the guesser — the latter is shape-identical to a location
// node, so only the key it hangs off distinguishes it
test('both assembly shorthands survive with a baseUri', () => {
  const cfg: {
    assemblies: (Loc & { sequence?: { adapter: Loc } })[]
  } = {
    assemblies: [
      { name: 'hg38', uri: 'hg38.fa.gz' },
      { name: 'hg19', sequence: { adapter: { uri: 'hg19.2bit' } } },
    ],
  }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg.assemblies[0]).toEqual({
    name: 'hg38',
    uri: 'hg38.fa.gz',
    baseUri: base,
  })
  expect(cfg.assemblies[1]!.sequence!.adapter).toEqual({
    uri: 'hg19.2bit',
    baseUri: base,
  })
})

test('a nested index location is resolved alongside its data file', () => {
  // regression: a shorthand `uri` on the adapter must not stop recursion into
  // the nested index location
  const cfg: { adapter: Loc } = {
    adapter: {
      type: 'BamAdapter',
      uri: 'aln.bam',
      index: { location: { uri: 'aln.bam.bai' } },
    },
  }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg.adapter.uri).toBe('aln.bam')
  expect(cfg.adapter.baseUri).toBe(base)
  expect(cfg.adapter.index!.location).toEqual({
    localPath: abs('aln.bam.bai'),
    locationType: 'LocalPathLocation',
  })
})

test('http/https and other-scheme uris are left untouched', () => {
  const cfg = {
    a: { uri: 'https://example.com/x.bw' },
    b: { uri: 'file:///abs/y.bam' },
    c: { uri: 'data:text/plain,hi' },
  }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg.a).toEqual({ uri: 'https://example.com/x.bw' })
  expect(cfg.b).toEqual({ uri: 'file:///abs/y.bam' })
  expect(cfg.c).toEqual({ uri: 'data:text/plain,hi' })
})

test('a Windows drive-letter uri is resolved as a path, not read as a scheme', () => {
  const cfg = { bamLocation: { uri: 'C:/data/sample.bam' } }
  relativeUrisToLocalPaths(cfg, dir)
  expect('uri' in cfg.bamLocation).toBe(false)
  expect(cfg.bamLocation).toEqual({
    localPath: abs('C:/data/sample.bam'),
    locationType: 'LocalPathLocation',
  })
})

test('a uri with an explicit baseUri (web/hub config) is left untouched', () => {
  const cfg = { uri: 'tracks/x.gff.gz', baseUri: 'https://host/config.json' }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg).toEqual({
    uri: 'tracks/x.gff.gz',
    baseUri: 'https://host/config.json',
  })
})

test('an existing localPath is left untouched', () => {
  const cfg = { location: { localPath: '/abs/z.cram' } }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg.location).toEqual({ localPath: '/abs/z.cram' })
})

test('walks arrays and assemblies, resolving every relative uri', () => {
  const cfg: {
    assemblies: { sequence: { adapter: Loc } }[]
    tracks: { adapter: Loc }[]
  } = {
    assemblies: [
      { sequence: { adapter: { uri: 'ref.fa.gz' } } },
      { sequence: { adapter: { uri: 'https://host/ref2.fa.gz' } } },
    ],
    tracks: [{ adapter: { uri: 'a.bw' } }, { adapter: { uri: 'b.bw' } }],
  }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg.assemblies[0]!.sequence.adapter).toEqual({
    uri: 'ref.fa.gz',
    baseUri: base,
  })
  expect(cfg.assemblies[1]!.sequence.adapter).toEqual({
    uri: 'https://host/ref2.fa.gz',
  })
  expect(cfg.tracks[0]!.adapter.baseUri).toBe(base)
  expect(cfg.tracks[1]!.adapter.baseUri).toBe(base)
})

test('non-object input is a no-op', () => {
  expect(() => {
    relativeUrisToLocalPaths(null, dir)
  }).not.toThrow()
  expect(() => {
    relativeUrisToLocalPaths('a string', dir)
  }).not.toThrow()
})
