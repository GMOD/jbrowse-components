import fs from 'fs'

import { rewriteMarkerBlock } from './util.ts'

// The GraphGenomeView `plugins` fence, rendered into every page that tells a
// reader to install the plugin, out of the configs the demos actually serve.
//
// Four pages carried it by hand — the graph genome view guide and the three
// pangenome tutorials — and what each one carries is a URL a reader pastes into
// their own config. Nothing compared those four against anything: the docs'
// `check-paste-configs` compares a film against its page's fence, and
// `check-remote-hosts` only asks which hosts a page reaches. So a plugin build
// published under a different name would have left four pages teaching a URL
// that 404s, and the first report would have come from a reader.
const CONFIGS = ['demos/ecoli_pangenome/config.json', 'demos/hprc/config.json']

interface PluginEntry {
  name: string
  esmUrl: string
}

// Both demos declare the plugin, and the docs carry ONE fence for both, so they
// have to agree. They diverge for a real reason — one demo pinned to a build
// hash while the other tracks the rolling URL — and that is the case where a
// single fence stops being true for one of the pages using it.
export function collectGraphPlugin(): PluginEntry[] {
  const seen = CONFIGS.map(file => {
    const { plugins } = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      plugins?: PluginEntry[]
    }
    if (!plugins?.length) {
      throw new Error(
        `${file}: no \`plugins\` array, which is where the graph plugin fence in the pangenome docs comes from`,
      )
    }
    return { file, plugins }
  })

  const [first, ...rest] = seen
  const canonical = JSON.stringify(first!.plugins)
  for (const other of rest) {
    if (JSON.stringify(other.plugins) !== canonical) {
      throw new Error(
        `${first!.file} and ${other.file} declare different plugins, so no single fence is true for both pages that install from them:\n  ${canonical}\n  ${JSON.stringify(other.plugins)}`,
      )
    }
  }
  return first!.plugins
}

export function writeGraphPluginDocs({ check = false } = {}) {
  // Two spaces and a trailing newline is what oxfmt leaves a json fence at, and
  // markers.ts writes without a formatting sweep, so the emitted bytes have to
  // already be the committed ones or `--check` reports every page stale forever.
  const json = JSON.stringify({ plugins: collectGraphPlugin() }, null, 2)
  return rewriteMarkerBlock(
    'GRAPH_PLUGIN_CONFIG',
    `\`\`\`json\n${json}\n\`\`\``,
    {
      check,
    },
  )
}
