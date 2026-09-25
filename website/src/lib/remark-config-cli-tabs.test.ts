import { CODE_BASE } from './code-base.ts'
import { configCliTabs } from './remark-config-cli-tabs.ts'

import type { Root } from 'mdast'

const TRACK = {
  type: 'VariantTrack',
  trackId: 'sv_calls',
  name: 'SV calls',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/sv.vcf.gz',
  },
}

function flatten(node: unknown): string {
  const n = node as { value?: string; url?: string; children?: unknown[] }
  const inner = n.value ?? (n.children ?? []).map(flatten).join('')
  return n.url ? `[${inner}](${n.url})` : inner
}

function render(meta: string, config: unknown = TRACK) {
  const tree: Root = {
    type: 'root',
    children: [
      { type: 'code', lang: 'json', meta, value: JSON.stringify(config) },
    ],
  }
  const messages: string[] = []
  configCliTabs(tree, message => messages.push(message))
  const html = tree.children.map(flatten).join('\n')
  return {
    html,
    messages,
    kinds: [...html.matchAll(/data-tab-kind="(\w+)"/g)].map(m => m[1]),
    hrefs: [...html.matchAll(/href="([^"]+)"/g)].map(m =>
      m[1]!.replaceAll('&amp;', '&'),
    ),
  }
}

test('each tab input carries its kind', () => {
  expect(render('addtrack').kinds).toEqual(['config', 'cli', 'desktop'])
  expect(
    render('addassembly', {
      name: 'hg38',
      uri: 'https://example.com/hg38.fa.gz',
    }).kinds,
  ).toEqual(['config', 'cli', 'desktop'])
  expect(
    render('session config=test_data/volvox/config.json', {
      defaultSession: {
        views: [
          { type: 'LinearGenomeView', assembly: 'volvox', tracks: ['a'] },
        ],
      },
    }).kinds,
  ).toEqual(['config', 'cli', 'live'])
})

test('the Config file tab says where the JSON goes', () => {
  const { html } = render('addtrack')
  const panel = html.slice(0, html.indexOf('data-tab-kind="cli"'))
  expect(panel).toContain(
    'Goes in the tracks array of config.json. See [Tracks](/docs/config_guides/tracks/).',
  )
})

test('config= on an addtrack fence opens the track as a session track', () => {
  const { kinds, hrefs, messages } = render(
    'addtrack config=test_data/volvox/config.json loc=chr1:1-100',
  )
  expect(messages).toEqual([])
  expect(kinds).toEqual(['config', 'cli', 'desktop', 'live'])
  const web = hrefs.find(h => h.startsWith(CODE_BASE))!
  const params = new URL(web).searchParams
  expect(params.get('config')).toBe('test_data/volvox/config.json')
  expect(params.get('sessionName')).toBe('JBrowse docs: SV calls')
  expect(JSON.parse(params.get('session')!.slice('spec-'.length))).toEqual({
    sessionTracks: [TRACK],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: 'chr1:1-100',
        tracks: ['sv_calls'],
      },
    ],
  })
  const desktop = hrefs.find(h => h.startsWith('jbrowse://'))!
  expect(new URL(desktop).searchParams.get('url')).toBe(web)
})

test('without loc= the live view opens on the whole genome', () => {
  const web = render('addtrack config=test_data/volvox/config.json').hrefs.find(
    h => h.startsWith(CODE_BASE),
  )!
  const spec = JSON.parse(
    new URL(web).searchParams.get('session')!.slice('spec-'.length),
  ) as { views: Record<string, unknown>[] }
  expect(spec.views[0]).not.toHaveProperty('loc')
})

test('config= on a fence naming a relative file is refused and gets no live tab', () => {
  const { kinds, messages } = render('addtrack config=test_data/x/config.json', {
    ...TRACK,
    adapter: { type: 'VcfTabixAdapter', uri: 'sv.vcf.gz' },
  })
  expect(kinds).toEqual(['config', 'cli', 'desktop'])
  expect(messages).toEqual([
    expect.stringContaining('names a file by a non-URL path (sv.vcf.gz)'),
  ])
})

test('a fence nested in a list item still renders', () => {
  const tree: Root = {
    type: 'root',
    children: [
      {
        type: 'list',
        children: [
          {
            type: 'listItem',
            children: [
              {
                type: 'code',
                lang: 'json',
                meta: 'addtrack',
                value: JSON.stringify(TRACK),
              },
            ],
          },
        ],
      },
    ],
  }
  configCliTabs(tree, () => {})
  expect(flatten(tree)).toContain('data-tab-kind="desktop"')
})
