import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { specs } from './screenshot-specs.ts'

import type { ScreenshotSpec } from './screenshot-spec-types.ts'

// Which screenshot specs can a set of changed files possibly have moved?
//
// The obvious answer — walk the import graph from the changed file to the specs
// that reach it — is worthless here: every browser spec loads the same
// jbrowse-web bundle, which imports all 32 plugins, so reachability says
// "everything" for almost any change. The usable signal is not what a spec
// IMPORTS, it is what it DECLARES IT RENDERS: a spec's session is JSON in its
// own URL, naming the view / track / display / adapter types it puts on screen.
//
// So impact is computed in one direction:
//
//   changed file
//     -> owning workspace package        (path prefix)
//     -> packages that depend on it      (reverse dependency closure)
//     -> plugins in that closure
//     -> pluggable-element type names those plugins own  (directory names
//        under plugins/<x>/src, which is how this repo lays them out)
//     -> specs whose session names any of those types
//
// The closure step is what makes the wide cases fall out for free instead of
// needing a hand-kept "these are core" list: @jbrowse/core is depended on by all
// 32 plugins, so a core change selects every spec by the same rule that makes a
// wiggle-core change select the 14 plugins that use it.
//
// This is an APPROXIMATION and is meant to be used as one. It answers "which
// specs are worth re-rendering right now", not "which specs are still correct" —
// the unfiltered sweep is the only thing that answers that, and because it only
// rewrites a PNG whose capture actually changed, it doubles as the oracle for
// this file: run it nightly and anything it rewrites that --affected would not
// have selected is a bug HERE. The cases most likely to produce one are called
// out below on FOUNDATIONAL_PLUGINS (a shared renderer no session names) and on
// SpecFingerprint.unresolved (a spec whose types could not be read, which is
// therefore always selected rather than guessed at).

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')
// relative `?config=` paths are served out of the jbrowse-web instance's own
// directory, the same root createTestServer hands the capture
const webRoot = path.join(repoRoot, 'products', 'jbrowse-web')

// `?config=https://jbrowse.org/demos/<n>/config.json` back to the repo file it
// was deployed from. Without this the ~40 specs on a hosted demo config have no
// readable track list and have to be treated as always-affected; with it they
// narrow like any local one. demos/ IS the source of truth for what is hosted
// (scripts/deploy-demo.sh publishes it), so this cannot go stale the way a
// fetched cache would, and it keeps the network out of a question that should be
// answerable offline.
function localConfigPath(
  config: string,
): { root: string; rel: string } | undefined {
  const demo = /^https?:\/\/jbrowse\.org\/demos\/([^/]+)\/config\.json$/.exec(
    config,
  )
  if (demo) {
    const rel = `demos/${demo[1]}/config.json`
    return fs.existsSync(path.join(repoRoot, rel))
      ? { root: repoRoot, rel }
      : undefined
  }
  return config.startsWith('http') ? undefined : { root: webRoot, rel: config }
}

// Plugins every figure is drawn through regardless of what its session names, so
// a change in them can't be narrowed by type. plugin-canvas is the shared
// renderer, and it also owns the DEFAULT display of track types whose config
// omits `displays` (a bare FeatureTrack renders a canvas LinearBasicDisplay that
// no session or config file ever mentions) — without this, a canvas change would
// miss exactly those specs. plugin-linear-genome-view needs no entry: 17 plugins
// depend on it, so the reverse closure already fans it out.
const FOUNDATIONAL_PLUGINS = new Set(['canvas'])

// Workspace packages that are only reachable from the app shell, never from a
// plugin, so the closure below yields no plugins and no types. They still draw
// every figure's chrome, so they mean "everything".
const APP_SHELL_PACKAGES = new Set([
  '@jbrowse/web',
  '@jbrowse/web-core',
  '@jbrowse/app-core',
  '@jbrowse/product-core',
  '@jbrowse/embedded-core',
])

export type Selection =
  | { kind: 'all'; reasons: string[] }
  | { kind: 'none'; reasons: string[] }
  | { kind: 'some'; names: Set<string>; reasons: string[] }

// ---------------------------------------------------------------------------
// workspace graph
// ---------------------------------------------------------------------------

interface WorkspacePackage {
  name: string
  dir: string // repo-relative
  deps: string[] // workspace deps only
}

function readWorkspace(): Map<string, WorkspacePackage> {
  const out = new Map<string, WorkspacePackage>()
  for (const group of ['packages', 'plugins', 'products']) {
    const groupDir = path.join(repoRoot, group)
    if (!fs.existsSync(groupDir)) {
      continue
    }
    for (const entry of fs.readdirSync(groupDir)) {
      const pkgPath = path.join(groupDir, entry, 'package.json')
      if (!fs.existsSync(pkgPath)) {
        continue
      }
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
        name?: string
        dependencies?: Record<string, string>
        peerDependencies?: Record<string, string>
      }
      if (!pkg.name) {
        continue
      }
      out.set(pkg.name, {
        name: pkg.name,
        dir: `${group}/${entry}`,
        deps: Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }),
      })
    }
  }
  // Resolve deps to workspace members only, after every member is known — a
  // package.json lists third-party deps in the same object.
  for (const pkg of out.values()) {
    pkg.deps = pkg.deps.filter(d => out.has(d))
  }
  return out
}

// Every workspace package that transitively depends on `name`, including itself.
function dependentsOf(
  workspace: Map<string, WorkspacePackage>,
  name: string,
): Set<string> {
  const out = new Set([name])
  let grew = true
  while (grew) {
    grew = false
    for (const pkg of workspace.values()) {
      if (!out.has(pkg.name) && pkg.deps.some(d => out.has(d))) {
        out.add(pkg.name)
        grew = true
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// which pluggable-element type names does each plugin own
// ---------------------------------------------------------------------------

// A plugin lays each pluggable element out in its own directory named for the
// registered type (plugins/alignments/src/BamAdapter, plugins/wiggle/src/
// MultiLinearWiggleDisplay, ...), so the filesystem IS the registry. Reading it
// beats grepping for `name: '<T>'` (which hits test files first) and beats
// booting a PluginManager in node (the plugins are .tsx, which node's type
// stripping won't parse). Types this misses are the ones no directory is named
// for; they simply never match a spec, and the plugin-level fallback covers the
// file that defines them.
function typesOwnedBy(pluginDirs: string[]): Set<string> {
  const out = new Set<string>()
  for (const dir of pluginDirs) {
    const srcDir = path.join(repoRoot, dir, 'src')
    if (!fs.existsSync(srcDir)) {
      continue
    }
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      // capitalized directory: the naming convention for a pluggable element.
      // Lowercase ones (shared/, util/) are support code, and a change in them
      // resolves to the whole plugin rather than to one type.
      if (entry.isDirectory() && /^[A-Z]/.test(entry.name)) {
        out.add(entry.name)
      }
    }
  }
  return out
}

// Every type name any in-repo plugin or package could register. Used to filter a
// session's `type` fields down to registered types: a session is full of other
// `type` keys (`colorBy: {type:'modifications'}`, a feature's `type:'gene'`,
// `mateAssembly`) that name no plugin and would otherwise be noise.
function allKnownTypes(workspace: Map<string, WorkspacePackage>): Set<string> {
  return typesOwnedBy(
    [...workspace.values()]
      .map(p => p.dir)
      .filter(d => d.startsWith('plugins/')),
  )
}

// ---------------------------------------------------------------------------
// spec fingerprints
// ---------------------------------------------------------------------------

export interface SpecFingerprint {
  name: string
  mode: ScreenshotSpec['mode']
  // registered type names this spec's session (and its resolved config tracks)
  // put on screen
  types: Set<string>
  // repo-relative path of the `?config=` file, when it is one this repo ships
  configPath?: string
  // the spec declares trackIds this run could not resolve to types, so its type
  // set is incomplete and it has to be treated as always-affected
  unresolved: boolean
  // spec drives the UI with actions/stages, so it also renders chrome its
  // session never names
  hasActions: boolean
  // website/scripts/specs/<f>.ts that exports it
  specFile?: string
}

function decodeSession(url: string): { config?: string; session?: unknown } {
  const q = url.indexOf('?')
  if (q === -1) {
    return {}
  }
  const params = new URLSearchParams(url.slice(q + 1))
  const config = params.get('config') ?? undefined
  const session = params.get('session')
  if (!session?.startsWith('spec-')) {
    return { config }
  }
  const raw = session.slice('spec-'.length)
  // Specs build these two ways — helpers that encodeURIComponent the JSON and
  // helpers that inline it raw. Parse either rather than making it the caller's
  // problem; a spec whose session won't parse is reported as unresolved, not
  // silently fingerprinted as empty.
  for (const decode of [(s: string) => s, decodeURIComponent]) {
    try {
      return { config, session: JSON.parse(decode(raw)) as unknown }
    } catch {
      // decodeURIComponent throws on a raw '%' as readily as JSON.parse throws
      // on an undecoded one, so both live under the same catch
    }
  }
  return { config }
}

function walk(
  node: unknown,
  onType: (t: string) => void,
  onTrackRef: (id: string) => void,
) {
  if (Array.isArray(node)) {
    for (const v of node) {
      walk(v, onType, onTrackRef)
    }
  } else if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if (typeof rec.type === 'string') {
      onType(rec.type)
    }
    // `tracks: ['volvox_cram_alignments']` — a bare id, whose types live in the
    // config file rather than in the session
    if (Array.isArray(rec.tracks)) {
      for (const t of rec.tracks) {
        if (typeof t === 'string') {
          onTrackRef(t)
        }
      }
    }
    for (const v of Object.values(rec)) {
      walk(v, onType, onTrackRef)
    }
  }
}

// trackId -> the type names that track puts on screen, read out of a config file
function indexConfig(configPath: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
    tracks?: Record<string, unknown>[]
    assemblies?: { sequence?: Record<string, unknown> }[]
  }
  const add = (track: Record<string, unknown>) => {
    const id = track.trackId
    if (typeof id !== 'string') {
      return
    }
    const types: string[] = []
    walk(
      track,
      t => types.push(t),
      () => {},
    )
    out.set(id, types)
  }
  for (const track of parsed.tracks ?? []) {
    add(track)
  }
  // An assembly's sequence track is a track a session can name (`volvox_refseq`)
  // but it lives under assemblies[].sequence rather than in tracks[]. Without it
  // every reference-sequence figure looked like a spec naming a track its config
  // does not have, i.e. unresolved, i.e. always re-rendered.
  for (const assembly of parsed.assemblies ?? []) {
    if (assembly.sequence) {
      add(assembly.sequence)
    }
  }
  return out
}

export function buildFingerprints(): SpecFingerprint[] {
  const workspace = readWorkspace()
  const known = allKnownTypes(workspace)
  const configCache = new Map<string, Map<string, string[]> | undefined>()

  const readConfig = (root: string, rel: string) => {
    if (!configCache.has(rel)) {
      try {
        configCache.set(rel, indexConfig(path.join(root, rel)))
      } catch {
        configCache.set(rel, undefined)
      }
    }
    return configCache.get(rel)
  }

  return specs.map(spec => {
    const types = new Set<string>()
    const trackRefs = new Set<string>()
    let unresolved = false
    let configPath: string | undefined

    if (spec.mode === 'url') {
      const { config, session } = decodeSession(spec.url)
      if (session === undefined) {
        // a landing-page spec with no session (config_not_found, top_level_menus)
        // has nothing to fingerprint, and a config the app fails to load has no
        // tracks — either way there is no type set to narrow by
        unresolved = true
      } else {
        walk(
          session,
          t => types.add(t),
          id => trackRefs.add(id),
        )
      }
      const local =
        config && config !== 'none' ? localConfigPath(config) : undefined
      if (local) {
        configPath = local.rel
        const index = readConfig(local.root, local.rel)
        if (index) {
          for (const id of trackRefs) {
            const resolved = index.get(id)
            if (resolved) {
              for (const t of resolved) {
                types.add(t)
              }
            } else {
              unresolved = true
            }
          }
        } else {
          unresolved = unresolved || trackRefs.size > 0
        }
      } else if (trackRefs.size > 0) {
        unresolved = true
      }
    } else if (spec.mode === 'embedded') {
      walk(
        spec.viewState,
        t => types.add(t),
        id => trackRefs.add(id),
      )
      unresolved = trackRefs.size > 0
    } else if (spec.mode === 'cli') {
      // jb2export renders through the plugins too, but from CLI args rather than
      // a session, so there is nothing to narrow by. They cost no browser, so
      // treating all 20 as always-affected is cheap.
      unresolved = true
    }
    // compose specs are handled by main() (it already pulls in any compose spec
    // whose parts a run touches), so their own type set is deliberately empty

    const hasActions =
      (spec.mode === 'url' && (spec.actions?.length ?? 0) > 0) ||
      ((spec.mode === 'url' || spec.mode === 'embedded') &&
        (spec.stages?.length ?? 0) > 0)

    const registered = new Set([...types].filter(t => known.has(t)))

    return {
      name: spec.name,
      mode: spec.mode,
      types: registered,
      configPath,
      // A spec that renders SOMETHING but resolved to no in-repo type is not
      // narrowable, it is unexplained: the import forms, the assembly manager,
      // the add-track flow, and anything driven by an out-of-repo plugin all
      // land here. Left as-is they would be the one thing worse than a slow
      // sweep — figures no source change ever selects. compose specs are the
      // deliberate exception: they own no session, and main() already pulls one
      // in whenever a run touches its parts.
      unresolved:
        unresolved || (spec.mode !== 'compose' && registered.size === 0),
      hasActions,
    }
  })
}

// ---------------------------------------------------------------------------
// spec-file ownership: which website/scripts/specs/*.ts exports which spec
// ---------------------------------------------------------------------------

// The most common change by far is to a spec file itself, and that case needs no
// heuristic at all: import the module and read the names it exports. Anything
// this can't attribute (jbrowseImgSpecs, which lives in the helpers barrel) just
// doesn't get the spec-file shortcut and falls through to the other rules.
export async function specFileOwners(): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const specsDir = path.join(__dirname, 'specs')
  for (const file of fs.readdirSync(specsDir)) {
    if (!file.endsWith('.ts')) {
      continue
    }
    const mod = (await import(path.join(specsDir, file))) as Record<
      string,
      unknown
    >
    for (const value of Object.values(mod)) {
      if (!Array.isArray(value)) {
        continue
      }
      for (const entry of value) {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof (entry as ScreenshotSpec).name === 'string' &&
          typeof (entry as ScreenshotSpec).mode === 'string'
        ) {
          out.set(
            (entry as ScreenshotSpec).name,
            `website/scripts/specs/${file}`,
          )
        }
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// the rule table
// ---------------------------------------------------------------------------

// Files that change how EVERY capture is produced rather than what any one of
// them shows: the generator, the shared action/annotation/image vocabulary, the
// spec helpers every session is built with, and the browser harness.
const GLOBAL_TRIGGERS = [
  'website/scripts/generate-screenshots.ts',
  'website/scripts/actions.ts',
  'website/scripts/annotations.ts',
  'website/scripts/image-pipeline.ts',
  'website/scripts/screenshot-spec-helpers.ts',
  'website/scripts/screenshot-specs.ts',
  'website/scripts/screenshot-spec-types.ts',
  'packages/browser-test-utils/',
  'config/webpack/',
]

export async function selectAffected(
  changedFiles: string[],
): Promise<Selection> {
  const workspace = readWorkspace()
  const fingerprints = buildFingerprints()
  const owners = await specFileOwners()
  const reasons: string[] = []

  const global = changedFiles.filter(f =>
    GLOBAL_TRIGGERS.some(t => (t.endsWith('/') ? f.startsWith(t) : f === t)),
  )
  if (global.length > 0) {
    return {
      kind: 'all',
      reasons: [`${global[0]} changes how every capture is produced`],
    }
  }

  // dir -> package, longest first so products/jbrowse-web wins over products/
  const byDir = [...workspace.values()].sort(
    (a, b) => b.dir.length - a.dir.length,
  )

  const selected = new Set<string>()
  const affectedTypes = new Set<string>()
  const changedPlugins = new Set<string>()
  const touchedConfigs = new Set<string>()

  for (const file of changedFiles) {
    // 1. a spec file selects exactly the specs it exports
    if (file.startsWith('website/scripts/specs/')) {
      const from = [...owners].filter(([, f]) => f === file).map(([n]) => n)
      for (const n of from) {
        selected.add(n)
      }
      reasons.push(`${file} -> ${from.length} spec(s) it exports`)
      continue
    }

    // 2. a config the specs load selects the specs that load it — both the
    // repo-served test_data ones and the demos/ files that deploy to the hosted
    // URLs the other specs point at
    if (file.startsWith('products/jbrowse-web/test_data/')) {
      touchedConfigs.add(file.slice('products/jbrowse-web/'.length))
      reasons.push(`${file} -> specs whose ?config= names it`)
      continue
    }
    if (file.startsWith('demos/') && file.endsWith('/config.json')) {
      touchedConfigs.add(file)
      reasons.push(`${file} -> specs on the demo it deploys to`)
      continue
    }

    // 3. a workspace source file selects through the dependency closure
    const pkg = byDir.find(p => file.startsWith(`${p.dir}/`))
    if (!pkg) {
      continue
    }

    if (APP_SHELL_PACKAGES.has(pkg.name)) {
      return {
        kind: 'all',
        reasons: [
          `${file} is app-shell code (${pkg.name}), drawn in every figure`,
        ],
      }
    }

    const dependents = dependentsOf(workspace, pkg.name)
    const pluginDirs = [...dependents]
      .map(n => workspace.get(n)!.dir)
      .filter(d => d.startsWith('plugins/'))

    if (pluginDirs.length === 0) {
      // a package no plugin depends on (jbrowse-cli, desktop, text-indexing)
      // renders nothing, unless it is jbrowse-img, whose CLI specs are already
      // always-affected
      reasons.push(`${file} (${pkg.name}) renders no figure`)
      continue
    }

    for (const d of pluginDirs) {
      const name = d.slice('plugins/'.length)
      changedPlugins.add(name)
      if (FOUNDATIONAL_PLUGINS.has(name)) {
        return {
          kind: 'all',
          reasons: [`${file} reaches plugin-${name}, which draws every figure`],
        }
      }
    }
    for (const t of typesOwnedBy(pluginDirs)) {
      affectedTypes.add(t)
    }
    reasons.push(
      `${file} (${pkg.name}) -> ${pluginDirs.length} plugin(s), ${typesOwnedBy(pluginDirs).size} type(s)`,
    )
  }

  let typeMatched = 0
  for (const fp of fingerprints) {
    if (
      touchedConfigs.size > 0 &&
      fp.configPath &&
      touchedConfigs.has(fp.configPath)
    ) {
      selected.add(fp.name)
    }
    if (affectedTypes.size === 0) {
      continue
    }
    if ([...fp.types].some(t => affectedTypes.has(t))) {
      typeMatched++
      selected.add(fp.name)
    } else if (fp.unresolved) {
      // A spec whose types could not be fully resolved cannot be ruled out, so
      // any source change keeps it in. Under-selecting is the failure mode that
      // publishes a stale figure; over-selecting only costs wall clock.
      selected.add(fp.name)
    }
  }

  // A plugin whose types no figure names can still be all over the corpus: the
  // widget/menu plugins (menus, grid-bookmark, jobs-management, trix,
  // authentication) register no track, display or adapter, so nothing about a
  // session mentions them — they only appear in a figure that CLICKS into them.
  // Matching zero specs there would mean a track-selector change never
  // re-rendered a track-selector figure, so fall back to every spec that drives
  // the UI. Derived from "owns nothing any session names" rather than a list of
  // plugin names, so a new widget plugin is covered the day it lands.
  if (affectedTypes.size > 0 && typeMatched === 0) {
    const driven = fingerprints.filter(fp => fp.hasActions)
    for (const fp of driven) {
      selected.add(fp.name)
    }
    reasons.push(
      `${[...changedPlugins].join(', ')} own no type any session names -> the ${driven.length} spec(s) that drive the UI`,
    )
  }

  if (selected.size === 0) {
    return {
      kind: 'none',
      reasons:
        reasons.length > 0 ? reasons : ['no changed file renders a figure'],
    }
  }
  return { kind: 'some', names: selected, reasons }
}

// ---------------------------------------------------------------------------
// git
// ---------------------------------------------------------------------------

// Changed files as `git diff <ref>` sees them: committed since <ref> AND
// uncommitted, plus untracked files. Deliberately reads the WORKING TREE rather
// than the index — this repo's worktree is shared between agents, and the
// question "what should I re-render" is about the files on disk.
export function changedFilesFromGit(ref: string): string[] {
  const run = (args: string[]) =>
    execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
  return [
    ...new Set([
      ...run(['diff', '--name-only', ref]),
      ...run(['ls-files', '--others', '--exclude-standard']),
    ]),
  ]
}

// ---------------------------------------------------------------------------
// CLI: inspect the mapping without rendering anything
// ---------------------------------------------------------------------------

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const args = process.argv.slice(2)
  const refFlag = args.findIndex(a => a === '--since')
  const ref = refFlag === -1 ? 'HEAD' : (args[refFlag + 1] ?? 'HEAD')
  const filesFlag = args.findIndex(a => a === '--files')
  const explicit =
    filesFlag === -1
      ? undefined
      : (args[filesFlag + 1] ?? '').split(',').filter(Boolean)

  if (args.includes('--fingerprints')) {
    for (const fp of buildFingerprints()) {
      console.log(
        `${fp.name}\n    types=${[...fp.types].join(',') || '(none)'}${fp.unresolved ? '  [unresolved -> always affected]' : ''}`,
      )
    }
  } else {
    const changed = explicit ?? changedFilesFromGit(ref)
    console.log(
      explicit
        ? `${changed.length} file(s) given`
        : `${changed.length} changed file(s) since ${ref}`,
    )
    const sel = await selectAffected(changed)
    for (const r of sel.reasons.slice(0, 20)) {
      console.log(`  · ${r}`)
    }
    if (sel.kind === 'all') {
      console.log(`\n=> ALL ${specs.length} specs`)
    } else if (sel.kind === 'none') {
      console.log('\n=> NO specs affected')
    } else {
      console.log(`\n=> ${sel.names.size}/${specs.length} specs`)
      console.log(
        [...sel.names]
          .sort()
          .map(n => `   ${n}`)
          .join('\n'),
      )
    }
  }
}
