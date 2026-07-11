import path from 'node:path'

import { relativeUrisToLocalPaths } from './relativeUrisToLocalPaths.ts'

const dir = path.resolve('/home/u/project')
const abs = (p: string) => path.resolve(dir, p)

test('bare relative uri becomes a localPath resolved against the config dir', () => {
  const cfg = { adapter: { type: 'BamAdapter', uri: 'sample.bam' } }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg.adapter).toEqual({
    type: 'BamAdapter',
    localPath: abs('sample.bam'),
    locationType: 'LocalPathLocation',
  })
})

test('a nested index location is resolved alongside its data file', () => {
  // regression: a shorthand `uri` on the adapter must not stop recursion into
  // the nested index location
  const cfg = {
    adapter: {
      type: 'BamAdapter',
      uri: 'aln.bam',
      index: { location: { uri: 'aln.bam.bai' } },
    },
  }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg.adapter.localPath).toBe(abs('aln.bam'))
  expect('uri' in cfg.adapter).toBe(false)
  expect(cfg.adapter.index.location).toEqual({
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
  const cfg = {
    assemblies: [
      { sequence: { adapter: { uri: 'ref.fa.gz' } } },
      { sequence: { adapter: { uri: 'https://host/ref2.fa.gz' } } },
    ],
    tracks: [{ adapter: { uri: 'a.bw' } }, { adapter: { uri: 'b.bw' } }],
  }
  relativeUrisToLocalPaths(cfg, dir)
  expect(cfg.assemblies[0]!.sequence.adapter).toEqual({
    localPath: abs('ref.fa.gz'),
    locationType: 'LocalPathLocation',
  })
  expect(cfg.assemblies[1]!.sequence.adapter).toEqual({
    uri: 'https://host/ref2.fa.gz',
  })
  expect(cfg.tracks[0]!.adapter.localPath).toBe(abs('a.bw'))
  expect(cfg.tracks[1]!.adapter.localPath).toBe(abs('b.bw'))
})

test('non-object input is a no-op', () => {
  expect(() => {
    relativeUrisToLocalPaths(null, dir)
  }).not.toThrow()
  expect(() => {
    relativeUrisToLocalPaths('a string', dir)
  }).not.toThrow()
})
