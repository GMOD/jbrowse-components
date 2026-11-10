import { CODE_BASE, liveHref } from './code-base.ts'
import { deriveAddTrack } from './derive-add-track.ts'
import { trackConfigUrl } from './derive-track-url.ts'
import { rawPageMarkdown } from './emit-raw-markdown.ts'
import { figureLiveRefs } from './liveLinks.generated.ts'
import { decodeSpecUrl, specConfigUrl } from './spec-recipe/decode.ts'

import type { Code, Html, Root, RootContent } from 'mdast'

const ORIGIN = 'https://jbrowse.org/jb2'

const TRACK = {
  type: 'VariantTrack',
  trackId: 'sv_calls',
  name: 'SV calls',
  assemblyNames: ['hg38'],
  adapter: { type: 'VcfTabixAdapter', uri: 'https://example.com/sv.vcf.gz' },
}

function span(start: number, end: number) {
  return {
    start: { line: 1, column: 1, offset: start },
    end: { line: 1, column: 1, offset: end },
  }
}

// What remark-parse makes of the first fence opening with `open`: its start is
// the fence marker, after any indentation, and its value is dedented.
function fenceAt(source: string, open: string): Code {
  const start = source.indexOf(open)
  const indent = start - (source.lastIndexOf('\n', start - 1) + 1)
  const close = source.indexOf('```', start + open.length)
  const [lang = '', ...meta] = open.slice(3).split(' ')
  return {
    type: 'code',
    lang,
    meta: meta.join(' ') || null,
    value: source
      .slice(source.indexOf('\n', start) + 1, close)
      .split('\n')
      .map(line => line.slice(indent))
      .join('\n')
      .trimEnd(),
    position: span(start, close + 3),
  }
}

function htmlAt(source: string, tag: string): Html {
  const start = source.indexOf(tag)
  return { type: 'html', value: tag, position: span(start, start + tag.length) }
}

function emit(body: string, children: RootContent[]) {
  const tree: Root = { type: 'root', children }
  return rawPageMarkdown(
    { rel: 'guide.md', body, slug: 'guide', title: 'Guide' },
    { origin: ORIGIN, parse: () => tree, titleOf: () => undefined },
  )
}

const trackFence = (open: string, indent = '') =>
  `${indent}${open}\n${JSON.stringify(TRACK, null, 2)
    .split('\n')
    .map(line => indent + line)
    .join('\n')}\n${indent}\`\`\``

test('an addtrack fence with loc= keeps a plain json fence, then the CLI and the config it opens on', () => {
  const open = '```json addtrack loc=chr1:1-100'
  const body = `Intro.\n\n${trackFence(open)}\n\nAfter.\n`
  const out = emit(body, [fenceAt(body, open)])
  const config = trackConfigUrl('addtrack loc=chr1:1-100', 'hg38')
  expect(config).toBeDefined()
  expect(out).not.toContain('addtrack')
  expect(out).not.toContain('session=spec-')
  expect(out).toContain(
    `\`\`\`json\n${JSON.stringify(TRACK, null, 2)}\n\`\`\`\n\nCLI:\n\n\`\`\`bash\n${deriveAddTrack(TRACK)}\n\`\`\`\n\nOpens on config <${config}> at \`chr1:1-100\`\n\nAfter.`,
  )
})

test('an addassembly fence no command expresses is the fence alone', () => {
  const open = '```json addassembly'
  const body = `${open}\n{ "name": "noFile" }\n\`\`\`\n\nAfter.\n`
  const out = emit(body, [fenceAt(body, open)])
  expect(out).toContain('```json\n{ "name": "noFile" }\n```\n\nAfter.')
  expect(out).not.toContain('CLI:')
})

test('a json live fence keeps a plain json fence, then the config it opens on', () => {
  const open = '```json live config=test_data/volvox/config.json'
  const spec = '{ "views": [{ "assembly": "volvox", "loc": "ctgA:1-100" }] }'
  const body = `${open}\n${spec}\n\`\`\`\n`
  const out = emit(body, [fenceAt(body, open)])
  expect(out).toContain(
    `\`\`\`json\n${spec}\n\`\`\`\n\nOpens on config <${CODE_BASE}test_data/volvox/config.json>`,
  )
})

test('an indented tagged fence gets its derived forms at its own indentation', () => {
  const open = '```json addtrack'
  const body = `- Add the track:\n\n${trackFence(open, '  ')}\n`
  const fence = fenceAt(body, open)
  const out = emit(body, [
    {
      type: 'list',
      position: span(0, body.length),
      children: [
        { type: 'listItem', position: span(0, body.length), children: [fence] },
      ],
    },
  ])
  expect(out).toContain('  ```json\n  {')
  expect(out).toContain(
    `  \`\`\`\n\n  CLI:\n\n  \`\`\`bash\n${deriveAddTrack(TRACK)!.replaceAll(/^/gm, '  ')}\n  \`\`\``,
  )
})

test('a Figure with a live ref gets its decoded session spec and config, not the encoded link', () => {
  const [name, ref] = Object.entries(figureLiveRefs).find(
    ([, r]) => decodeSpecUrl(liveHref(r)) !== undefined,
  )!
  const url = liveHref(ref)
  const tag = `<Figure caption="A view." src="/img/${name}.png" />`
  const body = `${tag}\n\nAfter.\n`
  const out = emit(body, [htmlAt(body, tag)])
  expect(out).toContain(
    `${tag}\n\nSession spec, on config <${specConfigUrl(url)}>:\n\n\`\`\`json\n${JSON.stringify(decodeSpecUrl(url)!.spec, null, 2)}\n\`\`\`\n\nAfter.`,
  )
})

test('a Figure whose live link is a long encoded session is unchanged', () => {
  const [name] = Object.entries(figureLiveRefs).find(
    ([, r]) => liveHref(r).includes('session=encoded-') && liveHref(r).length > 600,
  )!
  const tag = `<Figure caption="A view." src="/img/${name}.png" />`
  const body = `${tag}\n\nAfter.\n`
  expect(emit(body, [htmlAt(body, tag)])).toBe(`# Guide\n\n${body}\n`)
})

test('a Figure with no live ref is unchanged', () => {
  const tag = '<Figure caption="A sketch." src="/img/not_a_spec.png" />'
  const body = `${tag}\n\nAfter.\n`
  expect(emit(body, [htmlAt(body, tag)])).toBe(`# Guide\n\n${body}\n`)
})

test('relative links are still absolutized', () => {
  const body = 'See [tracks](/docs/config_guides/tracks/).\n'
  expect(emit(body, [])).toContain(
    `[tracks](${ORIGIN}/docs/config_guides/tracks/)`,
  )
})
