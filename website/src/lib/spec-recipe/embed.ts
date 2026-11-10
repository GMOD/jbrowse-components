import type { SessionSpec } from './decode.ts'

export const EMBED_PACKAGE = '@jbrowse/react-app2'

function literal(value: unknown, indent: string) {
  return JSON.stringify(value, null, 2).replaceAll('\n', `\n${indent}`)
}

// The React twin of the notebook snippet: jbrowse-anywidget is createApp from
// this package, and <JBrowse> takes the same assemblies, tracks and views, so
// the spec's views go in as they are. A fetched config's relative URIs resolve
// against the page unless stamped with the config's own URL first.
export function embedSnippet(configUrl: string, spec: SessionSpec) {
  const views = spec.views ?? []
  const tracks = spec.sessionTracks?.length
    ? `[...(config.tracks ?? []), ...${literal(spec.sessionTracks, '        ')}]`
    : 'config.tracks'
  return views.length
    ? [
        "import { use } from 'react'",
        `import { JBrowse } from '${EMBED_PACKAGE}'`,
        `import '${EMBED_PACKAGE}/styles.css'`,
        "import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'",
        '',
        `const configUrl = ${JSON.stringify(configUrl)}`,
        'const configPromise = fetch(configUrl)',
        '  .then(res => res.json())',
        '  .then(config => {',
        '    addRelativeUris(config, new URL(configUrl))',
        '    return config',
        '  })',
        '',
        'export default function Figure() {',
        '  const config = use(configPromise)',
        '  return (',
        '    <JBrowse',
        '      assemblies={config.assemblies}',
        `      tracks={${tracks}}`,
        '      aggregateTextSearchAdapters={config.aggregateTextSearchAdapters}',
        '      configuration={config.configuration}',
        `      views={${literal(views, '      ')}}`,
        '    />',
        '  )',
        '}',
      ].join('\n')
    : undefined
}
