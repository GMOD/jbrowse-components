// Reports which plugins in the published store still work against this build of
// the ABI, by reading the bundles rather than their source.
//
//   node --experimental-strip-types scripts/check-published-plugins.ts
//   node --experimental-strip-types scripts/check-published-plugins.ts --json
//   node --experimental-strip-types scripts/check-published-plugins.ts --check
//   node --experimental-strip-types scripts/check-published-plugins.ts --write
//
// Needs the network, so it is not a test and cannot ride `pnpm autogen`.
// Run it before tagging, and again after any affected plugin is rebuilt.
//
// **`--check` against a committed baseline is what makes it schedulable.** Both
// sides of the answer move without a commit here: a plugin author rebuilds, or
// the store gains an entry. So the useful signal is not "does anything break"
// (something usually does) but "did the answer change since anyone last looked",
// and abi-watch.yml runs `--check` weekly for exactly that. `--write` refreshes
// the baseline; commit it with a message saying which plugin moved and why.
//
// The baseline is also the only committed copy of a number the release
// announcement quotes. It said "one of the fourteen breaks against this build:
// Apollo, on BaseTooltip, isContainedWithin and getParentRenderProps", which
// nothing in the repo could confirm — the same shape of claim as the six typed
// figures that this release's draft got wrong.
//
// Why bundles: a plugin externalizes `@jbrowse/core/*`, so at runtime a bare
// import is a property read on the host's JBrowseExports. Nothing about that is
// visible in the plugin's source, its types, or its build -- a name we dropped
// just becomes `undefined` inside a build nobody is going to make again. So the
// only honest check is what the shipped bytes actually reach for.
//
// Reading is half of it. Each bundle is also *evaluated* against the RPC
// worker's export map (`ReExports/workerModules.ts`, built here with esbuild),
// since a plugin loads in the worker too and a UI stub of the wrong shape --
// `Vs.makeStyles is not a function` -- or a module-scope `document` read is a
// NetworkError in the browser and error-pages every session naming the plugin.
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
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'

import { build } from 'esbuild'

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
    const d = deps[1]!
      .split(',')
      .map(s => s.trim().replaceAll(/^["']|["']$/g, ''))
    const p = params[1]!.split(',').map(s => s.trim())
    d.forEach((mod, i) => {
      if (p[i]) {
        aliases[p[i]] = mod
      }
    })
  }
  return aliases
}

async function workerExports() {
  const outfile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'jbrowse-worker-exports-')),
    'workerModules.mjs',
  )
  await build({
    entryPoints: ['packages/core/src/ReExports/workerModules.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'warning',
  })
  const mod = (await import(outfile)) as { default: Record<string, unknown> }
  return mod.default
}

// What the worker's `importScripts` does to the bundle, in a fresh realm with
// the worker's export map and no DOM. The UMD wrapper assigns onto `this`.
function evaluateInWorkerRealm(
  src: string,
  JBrowseExports: Record<string, unknown>,
) {
  const realm: Record<string, unknown> = {
    JBrowseExports,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    Blob,
    fetch,
    AbortController,
    performance,
    crypto,
  }
  realm.self = realm
  realm.globalThis = realm
  try {
    vm.runInNewContext(src, realm, { filename: 'plugin.umd.js' })
    return undefined
  } catch (e) {
    return `worker eval: ${e instanceof Error ? e.message : String(e)}`
  }
}

const removed = removedNames()
const served = new Set(reExportsList)
const worker = await workerExports()
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
        `[(,\\s.]${alias.replaceAll('$', '\\$')}\\.${name}\\b`,
      )
      if (used.test(src)) {
        breaks.push(`${mod}#${name}`)
      }
    }
  }
  const evalError = evaluateInWorkerRealm(src, worker)
  if (evalError) {
    breaks.push(evalError)
  }
  report.push({
    plugin: p.name,
    ranges: [...new Set((p.versions ?? []).map(v => v.jbrowseRange ?? '*'))],
    breaks: [...new Set(breaks)].sort(),
  })
}

// Sorted, so a store that reorders its list is not a change. Only the fields
// that carry meaning: a version bump on a plugin that still breaks the same way
// is not news, and putting it in here would make the weekly run cry wolf.
const BASELINE = 'packages/core/src/ReExports/publishedPluginBreaks.json'
const baselineShape = () =>
  `${JSON.stringify(
    [...report]
      .sort((a, b) => a.plugin.localeCompare(b.plugin))
      .map(({ plugin, breaks }) => ({ plugin, breaks })),
    null,
    2,
  )}\n`

if (process.argv.includes('--write')) {
  fs.writeFileSync(BASELINE, baselineShape())
  console.log(`wrote ${BASELINE}`)
} else if (process.argv.includes('--check')) {
  const fresh = baselineShape()
  const committed = fs.existsSync(BASELINE)
    ? fs.readFileSync(BASELINE, 'utf8')
    : ''
  if (fresh === committed) {
    const broken = report.filter(r => r.breaks.length > 0)
    console.log(
      `unchanged: ${broken.length} of ${report.length} break against this build`,
    )
  } else {
    // Both directions matter, and the good one more: a plugin that stopped
    // breaking means an author rebuilt, which is the moment to drop it from the
    // upgrade advice in the release notes.
    const was = new Map<string, string[]>(
      (committed ? JSON.parse(committed) : []).map(
        (r: { plugin: string; breaks: string[] }) => [r.plugin, r.breaks],
      ),
    )
    const now = new Map(report.map(r => [r.plugin, r.breaks]))
    console.error(`${BASELINE} is out of date:`)
    for (const plugin of new Set([...was.keys(), ...now.keys()])) {
      const before = was.get(plugin)
      const after = now.get(plugin)
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        console.error(
          `  ${plugin}: ${before === undefined ? '(not in the store before)' : before.join(', ') || 'ok'}` +
            ` -> ${after === undefined ? '(gone from the store)' : after.join(', ') || 'ok'}`,
        )
      }
    }
    console.error(
      '\nRefresh with `node --experimental-strip-types scripts/check-published-plugins.ts --write`',
    )
    process.exit(1)
  }
} else if (process.argv.includes('--json')) {
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
