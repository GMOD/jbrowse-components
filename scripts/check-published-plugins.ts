// Reports which plugins in the published store still work against this build of
// the ABI, by reading the bundles rather than their source.
//
//   node --experimental-strip-types scripts/check-published-plugins.ts
//   node --experimental-strip-types scripts/check-published-plugins.ts --json
//
// Needs the network, so it is a manual pre-release check rather than a test.
// Run it before tagging, and again after any affected plugin is rebuilt.
//
// Why bundles: a plugin externalizes `@jbrowse/core/*`, so at runtime a bare
// import is a property read on the host's JBrowseExports. Nothing about that is
// visible in the plugin's source, its types, or its build -- a name we dropped
// just becomes `undefined` inside a build nobody is going to make again. So the
// only honest check is what the shipped bytes actually reach for.
//
// The distinction that matters, and that grepping the bundle for a name gets
// wrong: several plugins *bundle* core helpers (react-msaview carries a pile of
// deep imports, multilevel-linear-view2 vendors the whole util barrel), so the
// name appears in the bundle while being resolved locally. Only a read off an
// identifier that traces back to a JBrowseExports lookup can break.
// The served ABI is read from list.ts (the module paths) and abiBaseline.json
// (the names in each), not from modules.ts: that module's graph reaches .tsx,
// which --experimental-strip-types will not load. The two are kept in sync with
// modules.ts by a load-time throw and by abi.test.ts respectively.
import fs from 'fs'

import reExportsList from '../packages/core/src/ReExports/list.ts'

const STORE = 'https://jbrowse.org/plugin-store/v2/plugins.json'

interface StorePlugin {
  name: string
  packageName?: string
  url?: string
  umdUrl?: string
  versions?: { pluginVersion?: string; jbrowseRange?: string; url?: string }[]
}

const read = (f: string) =>
  JSON.parse(fs.readFileSync(`packages/core/src/ReExports/${f}`, 'utf8'))

// Names the previous release served that this build does not, per module.
function removedNames() {
  const previous = read('abiPreviousRelease.json') as {
    modules: Record<string, string[]>
  }
  const current = read('abiBaseline.json') as Record<string, string[]>
  const out: Record<string, Set<string>> = {}
  for (const [mod, names] of Object.entries(previous.modules)) {
    const served = new Set(current[mod] ?? [])
    const gone = names.filter(n => !served.has(n))
    if (gone.length > 0) {
      out[mod] = new Set(gone)
    }
  }
  return out
}

// alias -> module, for every identifier in the bundle that resolves to a
// JBrowseExports lookup. Two bundler shapes:
//   esbuild  `X=N((a,b)=>{b.exports=JBrowseExports["mod"]})`, then `Y=w(X())`
//   rollum   `define([...deps], function(...params))`, positional
function hostAliases(src: string) {
  const aliases: Record<string, string> = {}
  const shims: Record<string, string> = {}
  const shimRe =
    /[,;{(\s]([A-Za-z0-9_$]+)\s*=\s*[A-Za-z0-9_$]+\(\([^)]*\)=>\{[^}]*?\.exports\s*=\s*JBrowseExports\[\s*"([^"]+)"\s*\]/g
  for (const m of src.matchAll(shimRe)) {
    shims[m[1]!] = m[2]!
    aliases[m[1]!] = m[2]!
  }
  const nsRe =
    /[,;{(\s]([A-Za-z0-9_$]+)\s*=\s*[A-Za-z0-9_$]+\(\s*([A-Za-z0-9_$]+)\(\)\s*(?:,\s*\d+\s*)?\)/g
  for (const m of src.matchAll(nsRe)) {
    const mod = shims[m[2]!]
    if (mod) {
      aliases[m[1]!] = mod
    }
  }
  const deps = /define\(\[([^\]]*)\]/.exec(src)
  const params = /\}\(this,\s*\(?function\s*\(([^)]*)\)/.exec(src)
  if (deps && params) {
    const d = deps[1]!.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
    const p = params[1]!.split(',').map(s => s.trim())
    d.forEach((mod, i) => {
      if (p[i]) {
        aliases[p[i]] = mod
      }
    })
  }
  return aliases
}

const removed = removedNames()
const served = new Set(reExportsList)
const res = await fetch(STORE)
if (!res.ok) {
  throw new Error(`HTTP ${res.status} fetching ${STORE}`)
}
const { plugins } = (await res.json()) as { plugins: StorePlugin[] }

const report: {
  plugin: string
  ranges: string[]
  breaks: string[]
}[] = []

for (const p of plugins) {
  const url = p.url ?? p.umdUrl ?? p.versions?.at(-1)?.url
  if (!url) {
    report.push({
      plugin: p.name,
      ranges: [],
      breaks: ['no url in store entry'],
    })
    continue
  }
  const r = await fetch(url)
  if (!r.ok) {
    report.push({
      plugin: p.name,
      ranges: [],
      breaks: [`HTTP ${r.status} fetching bundle`],
    })
    continue
  }
  const src = await r.text()
  const breaks: string[] = []

  // a module the host does not serve at all: the lookup is undefined, and the
  // plugin's `class X extends Y.default` throws while PluginLoader is awaiting
  // it, which error-pages the whole app rather than just dropping the plugin
  for (const mod of new Set(src.match(/JBrowseExports\[\s*"[^"]+"/g) ?? [])) {
    const name = /"([^"]+)/.exec(mod)![1]!
    if (name.startsWith('@jbrowse/core/') && !served.has(name)) {
      breaks.push(`module ${name}`)
    }
  }
  for (const [alias, mod] of Object.entries(hostAliases(src))) {
    for (const name of removed[mod] ?? []) {
      const used = new RegExp(
        `[(,\\s.]${alias.replaceAll(/[$]/g, '\\$')}\\.${name}\\b`,
      )
      if (used.test(src)) {
        breaks.push(`${mod}#${name}`)
      }
    }
  }
  report.push({
    plugin: p.name,
    ranges: [...new Set((p.versions ?? []).map(v => v.jbrowseRange ?? '*'))],
    breaks: [...new Set(breaks)].sort(),
  })
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  for (const { plugin, ranges, breaks } of report) {
    const tag = breaks.length > 0 ? 'BREAKS' : 'ok'
    console.log(
      `${tag.padEnd(7)} ${plugin.padEnd(22)} range=${ranges.join(',') || '-'}  ${breaks.join(', ')}`,
    )
  }
  const broken = report.filter(r => r.breaks.length > 0)
  console.log(
    `\n${broken.length} of ${report.length} break against this build.`,
  )
  // A store entry declaring `*` is offered to every JBrowse version, so a broken
  // plugin is still presented as compatible. Pinning lives in the separate
  // GMOD/jbrowse-plugin-list repo.
  const unpinned = broken.filter(r => r.ranges.every(x => x === '*'))
  if (unpinned.length > 0) {
    console.log(
      `${unpinned.length} of those declare jbrowseRange "*", so the store still offers them: ${unpinned.map(r => r.plugin).join(', ')}`,
    )
  }
}
