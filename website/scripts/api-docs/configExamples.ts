import vm from 'node:vm'

import * as ts from 'typescript'

import {
  matchFormat,
  trackTypeForAdapter,
} from '../../../packages/add-track-core/src/index.ts'
import {
  hasSchemaDefinition,
  schemaProblems,
} from '../../../products/jbrowse-cli/src/commands/validate/schemaValidate.ts'
import { configManifest } from './configManifest.ts'
import { codeBlock, section } from './markdown.ts'

import type { TypedManifestEntry } from './configManifest.ts'
import type { ConfigWithHeader } from './configTypes.ts'

// Re-indent a bare adapter object so it nests cleanly as the 2-space-indented
// `adapter:` value of a track config, with a trailing comma. Prettier does not
// reformat embedded markdown code fences, so we emit final indentation here.
function adapterValueLines(code: string) {
  const [first, ...rest] = code.split('\n')
  const lines = [`  adapter: ${first}`, ...rest.map(line => `  ${line}`)]
  lines[lines.length - 1] += ','
  return lines
}

// A synteny track spans the assemblies its adapter names. Keep the track's
// assemblyNames consistent with the adapter snapshot it wraps: reuse the
// adapter's own query/target (or the assemblies it lists) rather than a generic
// placeholder that would contradict it. A composite adapter's example names a
// pair per child, so every list in the snapshot is unioned. `blockAssemblies`
// counts as one of those lists: an MCScan blocks adapter names its genomes
// there, and its own `assemblyNames` is an optional narrowing that an example
// showing the whole table has no reason to write.
function syntenyAssemblyNames(adapterCode: string) {
  const query = /queryAssembly:\s*['"]([^'"]*)['"]/.exec(adapterCode)
  const target = /targetAssembly:\s*['"]([^'"]*)['"]/.exec(adapterCode)
  const names = [
    ...new Set(
      [
        ...adapterCode.matchAll(
          /(?:assemblyNames|blockAssemblies):\s*\[([^\]]*)\]/g,
        ),
      ].flatMap(m => [...m[1]!.matchAll(/['"]([^'"]*)['"]/g)].map(n => n[1]!)),
    ),
  ]
  return query && target
    ? `['${query[1]}', '${target[1]}']`
    : names.length > 0
      ? `[${names.map(n => `'${n}'`).join(', ')}]`
      : "['assembly1', 'assembly2']"
}

function trackAssemblyNames(trackType: string, adapterCode: string) {
  return trackType === 'SyntenyTrack'
    ? syntenyAssemblyNames(adapterCode)
    : "['hg38']"
}

// The full track config that nests an adapter snapshot, shaped per track type:
// a reference sequence track has no assemblyNames (it is the assembly's own
// sequence) and synteny spans two assemblies, while ordinary data tracks take a
// single assembly.
function trackConfigLines(trackType: string, adapterCode: string) {
  const adapter = adapterValueLines(adapterCode)
  if (trackType === 'ReferenceSequenceTrack') {
    return [
      '{',
      "  type: 'ReferenceSequenceTrack',",
      "  trackId: 'my_assembly-ReferenceSequenceTrack',",
      ...adapter,
      '}',
    ]
  }
  const assemblyNames = trackAssemblyNames(trackType, adapterCode)
  return [
    '{',
    `  type: '${trackType}',`,
    "  trackId: 'my_track',",
    "  name: 'My track',",
    `  assemblyNames: ${assemblyNames},`,
    ...adapter,
    '}',
  ]
}

// An adapter's #example is authored as a bare adapter snapshot
// (`{ type: 'BamAdapter', uri: '...' }`). On the rendered page we want the full
// track configuration a user actually pastes, so wrap that snapshot's code
// fence as the `adapter:` value of a track config of the adapter's #trackType
// (defaulting to FeatureTrack). Prose around the fence is preserved; an example
// that already spells out a full config (declares trackId/adapter) is left
// alone. Final indentation is normalized by the oxfmt sweep in generate.ts.
export function wrapAdapterExample(
  content: string,
  trackType = 'FeatureTrack',
) {
  return content.replace(
    /```(?:js|javascript|json)?\n([\s\S]*?)\n```/g,
    (full: string, inner: string) => {
      const code = inner.trim()
      const isBareAdapter = code.startsWith('{') && /\btype\s*:/.test(code)
      const alreadyFull = /\b(?:trackId|adapter)\s*:/.test(code)
      return isBareAdapter && !alreadyFull
        ? ['```js', ...trackConfigLines(trackType, code), '```'].join('\n')
        : full
    },
  )
}

const SHORTEST_TRACK = '/docs/config_guides/tracks#the-shortest-track'

// A `#example` fence is JS object literal syntax, not JSON: bare keys and single
// quotes. Requote both and drop trailing commas, so the loose form is derived
// from the config a page actually shows rather than from a second copy of it.
// Anything richer than that — a jexl callback holding a quote, a comment —
// fails to parse and the page keeps only the form it had.
function parseFence(content: string) {
  const inner = /```(?:js|javascript|json)?\n([\s\S]*?)\n```/.exec(content)?.[1]
  try {
    return JSON.parse(
      (inner ?? '')
        .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
        .replace(/'([^']*)'/g, '"$1"')
        .replace(/,(\s*[}\]])/g, '$1'),
    ) as Record<string, unknown>
  } catch {
    return undefined
  }
}

// The keys `{ trackId, uri }` carries over on its own. A config naming anything
// beside them — a `displayDefaults` block, a second adapter slot — loses that
// key when written loose, so its page keeps only the full form.
const LOOSE_TOP_KEYS = new Set(['type', 'trackId', 'name', 'assemblyNames'])

// The loose form of the track config a page's example shows, or '' where the
// file name does not reach it. The formats table is the guess core installs, so
// ask it whether this file name resolves back to the page's own adapter and
// track type rather than restating which extension infers what — an adapter
// reachable only by naming its type then correctly offers nothing.
export function looseTrackExample(content: string) {
  const track = parseFence(content)
  const adapter = (track?.adapter ?? {}) as Record<string, unknown>
  const uri = typeof adapter.uri === 'string' ? adapter.uri : undefined
  const file = uri?.split('/').pop()
  const spec = file ? matchFormat(file)?.spec : undefined
  const trackType = track?.type
  if (
    !track ||
    !uri ||
    !file ||
    !spec ||
    typeof trackType !== 'string' ||
    typeof track.trackId !== 'string' ||
    !Array.isArray(track.assemblyNames) ||
    Object.keys(track).some(
      key => !LOOSE_TOP_KEYS.has(key) && key !== 'adapter',
    )
  ) {
    return ''
  }
  const adapterType = adapter.type
  return Object.keys(adapter).length === 2 &&
    typeof adapterType === 'string' &&
    'adapterType' in spec &&
    spec.adapterType === adapterType &&
    trackTypeForAdapter(adapterType, file) === trackType
    ? section(
        `JBrowse infers \`${adapterType}\` and \`${trackType}\` from \`${file}\`, and \`name\` defaults to the file name. In a config declaring one assembly, \`assemblyNames\` comes from there too — see [the shortest track](${SHORTEST_TRACK}).`,
        codeBlock(
          '{',
          `  trackId: '${track.trackId}',`,
          `  uri: '${uri}',`,
          `  assemblyNames: [${track.assemblyNames.map(n => `'${n}'`).join(', ')}],`,
          '}',
        ),
      )
    : ''
}

// Categories whose objects an `#example` can be checked against
// (assertExamplesValidate).
//
// TEXT SEARCH adapters are the one type table left out: the manifest computes
// `shorthandKeys` only for `group === 'adapter'` (`generateConfigManifest`), so
// a text search adapter that does accept a shorthand records none —
// TrixTextSearchAdapter's `preProcessSnapshot` expands `uri` into its three file
// paths, and checking against its slot list alone reports that `uri` as unknown.
// A gate that rejects correct documentation is worse than a narrower one.
const EXAMPLE_CHECKED_CATEGORIES = new Set([
  'adapters',
  'connections',
  'tracks',
  'displays',
])

interface ExampleObject {
  // the `type` the object claims, when the manifest carries that type
  typeName: string
  entry: TypedManifestEntry
  keys: string[]
  // keys of this object's `displayDefaults` block, which route by the TRACK's
  // display types rather than by any one display's slots
  displayDefaultKeys?: string[]
}

// Every object literal an `#example` writes, paired with the manifest entry its
// own `type` names. Parsed rather than regexed because an example is JS, not
// JSON — unquoted keys, single quotes, nested objects whose keys must not be
// mistaken for the outer ones.
//
// Keyed on each object's own `type`, not on the page's. An example is written in
// whatever shape a reader can paste, so the object a page is ABOUT is rarely the
// outer one: a display's example is a whole track config carrying the display
// two levels down, a sequence adapter is shown inside its ReferenceSequenceTrack,
// an alias adapter inside the whole assembly. Checking only the page's own type
// left every display example unchecked, which is how three of them came to
// document a key JBrowse drops.
//
// The walk stops at a `frozen` slot. Its value passes through no
// ConfigurationSchema, so nothing inside it is a slot of anything and whatever
// reads it picks its own shape — MultiWiggleAdapter reads `name`/`group`/`color`
// off each `subadapters` entry, none of which the subadapter type declares.
export function exampleObjects(
  code: string,
  manifest: Record<string, TypedManifestEntry>,
) {
  const body = code.trim()
  // One example is a fragment naming its parent key (`sequence: {…}`), which is
  // not an expression. Braces make it an object whose outer level carries no
  // `type` and so is checked against nothing, while the object it holds is.
  const source = ts.createSourceFile(
    'example.ts',
    `const __example = ${body.startsWith('{') ? body : `{${body}}`}`,
    ts.ScriptTarget.Latest,
    true,
  )
  const keyOf = (p: ts.ObjectLiteralElementLike) =>
    p.name?.getText().replaceAll(/['"]/g, '')
  const propNamed = (obj: ts.ObjectLiteralExpression, name: string) =>
    obj.properties.find(p => keyOf(p) === name)
  const out: ExampleObject[] = []

  const walkObject = (obj: ts.ObjectLiteralExpression) => {
    const type = propNamed(obj, 'type')
    const typeName =
      type &&
      ts.isPropertyAssignment(type) &&
      ts.isStringLiteralLike(type.initializer)
        ? type.initializer.text
        : undefined
    const entry = typeName ? manifest[typeName] : undefined
    const defaults = propNamed(obj, 'displayDefaults')
    if (entry) {
      out.push({
        typeName: typeName!,
        entry,
        keys: obj.properties.map(keyOf).filter((n): n is string => !!n),
        displayDefaultKeys:
          defaults &&
          ts.isPropertyAssignment(defaults) &&
          ts.isObjectLiteralExpression(defaults.initializer)
            ? defaults.initializer.properties
                .map(keyOf)
                .filter((n): n is string => !!n)
            : undefined,
      })
    }
    const frozen = new Set(
      (entry?.slots ?? [])
        .filter(s => s.type.includes('frozen'))
        .map(s => s.name),
    )
    for (const p of obj.properties) {
      const name = keyOf(p)
      if (ts.isPropertyAssignment(p) && !(name && frozen.has(name))) {
        descend(p.initializer)
      }
    }
  }
  const descend = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      walkObject(node)
    } else {
      ts.forEachChild(node, descend)
    }
  }
  descend(source)
  return out
}

// Each object in an example whose `type` names a schema definition, validated
// against it by `jbrowse validate`'s own schema checker. Keys alone are
// `unknownExampleKeys`' job; this is the values — a constant color written as a
// field, a number where an enum goes.
function exampleSchemaProblems(code: string) {
  const body = code.trim()
  const value: unknown = vm.runInNewContext(
    `(${body.startsWith('{') ? body : `{${body}}`})`,
  )
  const problems: string[] = []
  const descend = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => {
        descend(child, `${path}[${i}]`)
      })
    } else if (node && typeof node === 'object') {
      const { type } = node as { type?: unknown }
      if (typeof type === 'string' && hasSchemaDefinition(type)) {
        for (const p of schemaProblems(node, `/$defs/${type}`)) {
          problems.push(`${path}${p.where}: ${p.message}`)
        }
      } else {
        for (const [key, child] of Object.entries(node)) {
          descend(child, path ? `${path}.${key}` : key)
        }
      }
    }
  }
  descend(value, '')
  return problems
}

// Every js/json fence in an `#example` must validate: each key one the type
// declares or a shorthand its snapshot normalizer rewrites, each value of the
// type the schema states. The examples are the most-copied config in the docs,
// and JBrowse ignores an undeclared key rather than rejecting it, so a wrong
// one loads, does nothing, and reads as the documented way to do the thing.
// `check-config-blocks` skips these pages because the fix belongs in source.
//
// Keys come from the same manifest the shorthand line above reads, so a type
// the manifest does not carry (the root config schemas) is skipped rather than
// guessed at. The type tables checkable at all are EXAMPLE_CHECKED_CATEGORIES.
const CONFIG_FENCE = /```(?:js|json)\n([\s\S]*?)```/g

export function assertExamplesValidate(
  configs: ConfigWithHeader[],
  displayTypesByTrack: Map<string, string[]>,
) {
  const manifest = configManifest()
  const checkable = Object.fromEntries(
    Object.entries(manifest).filter(([, entry]) =>
      EXAMPLE_CHECKED_CATEGORIES.has(entry.category),
    ),
  )
  const problems: string[] = []
  for (const config of configs) {
    const where = `  ${config.filename}: ${config.header.name} #example`
    for (const ex of config.header.examples) {
      for (const [, code] of ex.content.matchAll(CONFIG_FENCE)) {
        try {
          for (const p of exampleSchemaProblems(code!)) {
            problems.push(`${where} ${p}`)
          }
        } catch (e) {
          problems.push(`${where} does not evaluate: ${String(e)}`)
        }
        for (const obj of exampleObjects(code!, checkable)) {
          const unknown = unknownExampleKeys(
            obj,
            checkable,
            displayTypesByTrack,
          )
          for (const [key, why] of unknown) {
            problems.push(
              `${where} writes \`${key}\` on its ${obj.typeName} — ${why}`,
            )
          }
        }
      }
    }
  }
  if (problems.length) {
    throw new Error(
      `${problems.length} #example problem(s). JBrowse ignores an undeclared key, so such an example loads and silently does nothing. Fix the example, or add the slot:\n${problems.join('\n')}`,
    )
  }
}

// The keys of one example object that reach no slot, each with why — the two
// wrong places differ in what the reader should do, so the message does too.
export function unknownExampleKeys(
  obj: ExampleObject,
  manifest: Record<string, TypedManifestEntry>,
  displayTypesByTrack: Map<string, string[]>,
): [string, string][] {
  const known = new Set([
    ...obj.entry.slots.map(s => s.name),
    ...(obj.entry.shorthandKeys ?? []),
    // A track's per-display shorthand. Not a declared slot — the track config
    // schema's preProcessSnapshot folds it into `displays` — so the manifest
    // does not carry it, and it is the form the guides tell readers to write.
    ...(obj.entry.category === 'tracks' ? ['displayDefaults'] : []),
  ])
  const out = obj.keys
    .filter(k => !known.has(k))
    .map((key): [string, string] => [
      key,
      obj.entry.stateModelProps?.includes(key)
        ? 'a display state-model property, which a saved session sets and a track config drops'
        : 'not a slot it declares',
    ])
  // `displayDefaults` routes each setting to every display type of the track
  // that declares that slot (`collectDisplayOverrides`), so the union is the
  // rule — asking any one display would reject a key another display of the
  // same track owns. A key no display declares only warns at runtime, in a
  // console nobody is reading when they paste an example.
  const displaySlots = new Set(
    (displayTypesByTrack.get(obj.typeName) ?? []).flatMap(
      name => manifest[name]?.slots.map(s => s.name) ?? [],
    ),
  )
  out.push(
    ...(obj.displayDefaultKeys ?? [])
      .filter(k => !displaySlots.has(k))
      .map((key): [string, string] => [
        key,
        `in displayDefaults, and no display of a ${obj.typeName} declares it`,
      ]),
  )
  return out
}
