import {
  desktopAssemblyNodes,
  desktopTrackNodes,
} from './derive-desktop-steps.ts'

import type { RootContent } from 'mdast'

function flatten(nodes: RootContent[] | undefined) {
  const walk = (node: unknown): string => {
    const n = node as { value?: string; children?: unknown[] }
    return n.value ?? (n.children ?? []).map(walk).join('')
  }
  return nodes?.map(walk).join('\n')
}

test('a bgzipped fasta names the two index files the form asks for', () => {
  expect(
    flatten(
      desktopAssemblyNodes({
        name: 'hg38',
        displayName: 'Human (hg38)',
        uri: 'https://example.com/hg38.fa.gz',
      }),
    ),
  ).toMatchInlineSnapshot(`
    "<div class="desktop-steps">
    In JBrowse Desktop, Open new genome on the start screen (or File → Open genome... in a session), then Open from a URL and paste, one per line:
    https://example.com/hg38.fa.gz
    https://example.com/hg38.fa.gz.fai
    https://example.com/hg38.fa.gz.gzi
    JBrowse reads the format off the file name. Then fill in:
    Genome name: hg38Assembly display name (under More options): Human (hg38)
    </div>"
  `)
})

test('a 2bit carries its own names, so the paste is one line', () => {
  expect(
    flatten(desktopAssemblyNodes({ name: 'volvox', uri: 'volvox.2bit' })),
  ).toContain('and paste:\nvolvox.2bit\n')
})

test('a refName aliases file becomes a More options field', () => {
  expect(
    flatten(
      desktopAssemblyNodes({
        name: 'volvox',
        uri: 'volvox.2bit',
        refNameAliases: { uri: 'volvox.chromAliases.txt' },
      }),
    ),
  ).toContain('refName aliases (under More options): volvox.chromAliases.txt')
})

// Refused rather than shown with the unexpressible slot dropped: a reader who
// followed such a tab would get an assembly that behaves differently from the
// one the config file tab describes.
test.each([
  ['an alias the form has no input for', { aliases: ['GRCh38'] }],
  ['a slot only config.json carries', { geneticCodes: { 1: 'x' } }],
  [
    'a non-sibling index',
    {
      sequence: {
        adapter: {
          uri: 'hg38.fa.gz',
          faiLocation: { uri: 'elsewhere/hg38.fa.gz.fai' },
        },
      },
    },
  ],
  ['a sequence file no add-genome format opens', { uri: 'hg38.gff.gz' }],
])('refuses %s', (_name, extra) => {
  expect(
    desktopAssemblyNodes({ name: 'hg38', uri: 'hg38.fa.gz', ...extra }),
  ).toBeUndefined()
})

test('a graph adapter walks the plugin form instead of the paste box', () => {
  const config = {
    type: 'FeatureTrack',
    trackId: 'hprc_minigraph_segments',
    name: 'HPRC release 2 graph (rGFA segments)',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'RgfaTabixAdapter',
      uri: 'https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38',
      assemblyNameToPanSN: { hg38: 'GRCh38' },
    },
  }
  const out = flatten(desktopTrackNodes(config, JSON.stringify(config)))
  expect(out).toContain('Add pangenome graph track')
  expect(out).toContain('rGFA segments (tabix BED pair)')
  expect(out).toContain(
    'https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.segs.bed.gz',
  )
  expect(out).toContain('GRCh38')
  expect(out).not.toContain('Add track from pasted JSON')
})

test('a graph track with hand-set displays falls back to the paste box', () => {
  const config = {
    type: 'FeatureTrack',
    trackId: 't',
    assemblyNames: ['hg38'],
    adapter: { type: 'MinigraphBubbleAdapter', uri: 'https://x/b.bed.gz' },
    displays: [{ type: 'LinearBasicDisplay', displayId: 'd' }],
  }
  expect(flatten(desktopTrackNodes(config, '{}'))).toContain(
    'Add track from pasted JSON',
  )
})

test('a relative track uri is named as the file to replace before pasting', () => {
  const config = {
    type: 'FeatureTrack',
    trackId: 'genes',
    name: 'Genes',
    assemblyNames: ['volvox'],
    adapter: { type: 'Gff3TabixAdapter', uri: 'volvox.sort.gff3.gz' },
  }
  expect(flatten(desktopTrackNodes(config, JSON.stringify(config)))).toContain(
    'volvox.sort.gff3.gz is relative to a config.json. Replace it with its URL or its path on this computer.',
  )
})

test('a file written as a bare string is named as one to replace too', () => {
  const config = {
    type: 'SyntenyTrack',
    trackId: 'orthologs',
    assemblyNames: ['grape', 'peach'],
    adapter: {
      type: 'MCScanBlocksAdapter',
      uri: 'https://x/grape.blocks',
      blockAssemblies: ['grape', 'peach'],
      bedLocations: ['grape.bed', 'peach.bed'],
    },
    textSearching: { textSearchAdapter: 'trix/orthologs.ix' },
  }
  expect(flatten(desktopTrackNodes(config, JSON.stringify(config)))).toContain(
    'grape.bed, peach.bed, trix/orthologs.ix are relative to a config.json.',
  )
})

test('absolute uris and local paths need no replacing', () => {
  const config = {
    type: 'FeatureTrack',
    trackId: 'genes',
    name: 'Genes',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'BigWigAdapter',
      uri: 'https://example.com/a.bw',
      index: { location: { uri: '/data/a.bw.tbi' } },
    },
  }
  expect(
    flatten(desktopTrackNodes(config, JSON.stringify(config))),
  ).not.toContain('relative to a config.json')
})
