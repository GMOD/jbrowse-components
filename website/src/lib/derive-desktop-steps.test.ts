import { desktopAssemblyNodes } from './derive-desktop-steps.ts'

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
