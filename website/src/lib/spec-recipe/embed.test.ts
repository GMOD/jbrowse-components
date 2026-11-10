import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoRoot } from '../../../scripts/paths.ts'
import { recipeDialogHtml } from './html.ts'
import { buildRecipe } from './recipe.ts'

import type { SessionSpec } from './decode.ts'

const hg38 = 'https://jbrowse.org/ucsc/hg38/config.json'

function recipeOf(spec: SessionSpec, config = hg38) {
  return buildRecipe(
    `https://jbrowse.org/code/jb2/main/?config=${encodeURIComponent(config)}&session=spec-${encodeURIComponent(JSON.stringify(spec))}`,
  )!
}

const linearSpec = {
  sessionTracks: [
    {
      trackId: 'mine',
      type: 'FeatureTrack',
      assemblyNames: ['hg38'],
      adapter: { type: 'BedTabixAdapter', uri: 'https://example.org/mine.bed.gz' },
    },
  ],
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: 'chr17:43,044,295-43,125,483',
      tracks: [
        'hg38-phyloP100way',
        { trackId: 'mine', displayMode: 'compact', height: 120 },
      ],
    },
  ],
}

const linear = recipeOf(linearSpec).embed!

test('a linear view fetches its hosted config and opens the spec views in <JBrowse>', () => {
  expect(linear).toContain("import { JBrowse } from '@jbrowse/react-app2'")
  expect(linear).toContain("import '@jbrowse/react-app2/styles.css'")
  expect(linear).toContain(
    "import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'",
  )
  expect(linear).toContain(`const configUrl = "${hg38}"`)
  expect(linear).toContain('addRelativeUris(config, new URL(configUrl))')
  expect(linear).toContain('const config = use(configPromise)')
  expect(linear).toContain('assemblies={config.assemblies}')
  expect(linear).toContain('tracks={[...(config.tracks ?? []), ...[')
  expect(linear).toContain('aggregateTextSearchAdapters={config.aggregateTextSearchAdapters}')
  expect(linear).toContain('configuration={config.configuration}')
})

test("the views prop is the spec's views, display settings included", () => {
  const views = /views=\{([\s\S]*)\}\n {4}\/>/.exec(linear)?.[1]
  const tracks = /tracks=\{\[\.\.\.\(config\.tracks \?\? \[\]\), \.\.\.([\s\S]*?)\]\}\n/.exec(
    linear,
  )?.[1]
  expect(JSON.parse(views!)).toEqual(linearSpec.views)
  expect(JSON.parse(tracks!)).toEqual(linearSpec.sessionTracks)
})

test('a spec with no session tracks passes the config tracks alone', () => {
  const { sessionTracks, ...rest } = linearSpec
  expect(recipeOf(rest).embed).toContain('tracks={config.tracks}')
})

test('a view type the embedded app lacks has no snippet', () => {
  const graph = recipeOf({
    views: [{ type: 'GraphGenomeView', assembly: 'hg38' }],
  })
  expect(graph.embed).toBeUndefined()
  expect(graph.python).toBeUndefined()
  expect(recipeDialogHtml(graph, 'g')).not.toContain('data-tab-kind="embed"')
})

test('a spec with no views (an import form) has no snippet', () => {
  expect(recipeOf({ views: [] }).embed).toBeUndefined()
})

test('a multi-view spec opens every view, since <JBrowse> takes the list', () => {
  const spec = {
    views: [
      { type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr1:1-1000' },
      { type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr2:1-1000' },
    ],
  }
  const views = /views=\{([\s\S]*)\}\n {4}\/>/.exec(recipeOf(spec).embed!)?.[1]
  expect(JSON.parse(views!)).toEqual(spec.views)
})

test('the dialog gets an Embed tab after the Notebook tab', () => {
  const html = recipeDialogHtml(recipeOf(linearSpec), 'e')
  expect(html).toContain('data-tab-kind="embed"')
  expect(html.indexOf('data-tab-kind="embed"')).toBeGreaterThan(
    html.indexOf('data-tab-kind="notebook"'),
  )
  expect(html).toContain('href="/docs/embedded_components/"')
})

function read(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

function exportedNames(source: string) {
  const blocks = [...source.matchAll(/export\s*\{([^}]*)\}/g)].flatMap(m =>
    m[1]!.split(','),
  )
  const named = blocks
    .map(entry => entry.trim().split(/\s+as\s+/).at(-1)!)
    .filter(Boolean)
  const declared = [
    ...source.matchAll(/export (?:async )?(?:function|const) (\w+)/g),
  ].map(m => m[1]!)
  return new Set([...named, ...declared])
}

const ENTRIES: Record<string, string> = {
  '@jbrowse/react-app2': 'products/jbrowse-react-app/src/index.ts',
  '@jbrowse/core/util/addRelativeUris':
    'packages/core/src/util/addRelativeUris.ts',
}

test('every name the snippet imports is exported by its package source', async () => {
  const imports = [
    ...linear.matchAll(/^import \{ (\w+) \} from '([^']+)'$/gm),
  ].map(m => [m[1]!, m[2]!] as const)
  expect(imports.map(([, from]) => from).sort()).toEqual([
    ...Object.keys(ENTRIES),
    'react',
  ].sort())
  for (const [name, from] of imports) {
    if (from === 'react') {
      expect(await import('react')).toHaveProperty(name)
    } else {
      expect(exportedNames(read(ENTRIES[from]!))).toContain(name)
    }
  }
})

test("the snippet's subpath imports are in the packages' export maps", () => {
  const appExports = JSON.parse(read('products/jbrowse-react-app/package.json'))
    .publishConfig.exports
  const coreExports = JSON.parse(read('packages/core/package.json')).publishConfig
    .exports
  expect(appExports['./styles.css']).toBeDefined()
  expect(coreExports['./util/addRelativeUris']).toBeDefined()
})

test('<JBrowse> takes every prop the snippet passes', () => {
  const props = /export interface JBrowseProps \{([\s\S]*?)\n\}/.exec(
    read('products/jbrowse-react-app/src/JBrowse/JBrowse.tsx'),
  )?.[1]
  const passed = [...linear.matchAll(/^ {6}(\w+)=\{/gm)].map(m => m[1]!)
  expect(passed).toEqual([
    'assemblies',
    'tracks',
    'aggregateTextSearchAdapters',
    'configuration',
    'views',
  ])
  for (const prop of passed) {
    expect(props).toMatch(new RegExp(`^ {2}${prop}\\??:`, 'm'))
  }
})
