// Validates the track configs and session track entries written as TypeScript
// object literals, which neither `jbrowse validate` (config.json files) nor
// check-config-blocks (markdown fences) reads: the examples sites' demos and
// the browser-test suites and probes. A renamed slot value or a closed schema
// otherwise breaks these at load with every gate green, as ADR-216's
// `mark: 'heatmap'` did. Each literal goes through the CLI's generated JSON
// Schema; a value the file computes stands as a placeholder whose problems are
// dropped, so only what the source spells out is judged.

import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

import { configManifest } from '../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import { configJsonSchema } from '../products/jbrowse-cli/src/commands/validate/configSchema.generated.ts'
import { schemaProblems } from '../products/jbrowse-cli/src/commands/validate/schemaValidate.ts'

const root = path.join(__dirname, '..')
const BROWSER_TESTS = 'products/jbrowse-web/browser-tests'
const BROWSER_TEST_CONFIG = 'test_data/volvox/config.json'

const sources = [
  ...fs
    .globSync('products/*/examples-site/src/examples/*.{ts,tsx}', { cwd: root })
    .sort(),
  ...fs
    .globSync(`${BROWSER_TESTS}/{suites/*,probe-*}.ts`, { cwd: root })
    .sort(),
]

const COMPUTED = '<computed>'
const defs = configJsonSchema.$defs as Record<string, unknown>

type Obj = Record<string, unknown>

// Paths of values the file computes, and of objects with a spread or a
// computed key, whose missing keys may arrive that way.
interface Holes {
  computed: string[]
  open: string[]
}

function canonical(
  group: Record<string, { aliases?: string[] }>,
  name: unknown,
) {
  return typeof name !== 'string'
    ? undefined
    : name in group
      ? name
      : Object.keys(group).find(k => group[k]!.aliases?.includes(name))
}

function child(where: string, key: string | number) {
  return typeof key === 'number'
    ? `${where}[${key}]`
    : where
      ? `${where}.${key}`
      : key
}

function unwrap(node: ts.Expression): ts.Expression {
  return ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isTypeAssertionExpression(node)
    ? unwrap(node.expression)
    : node
}

function keyOf(name: ts.PropertyName) {
  return ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : undefined
}

function properties(node: ts.ObjectLiteralExpression) {
  return new Map(
    node.properties.flatMap(p =>
      ts.isPropertyAssignment(p) && keyOf(p.name) !== undefined
        ? [[keyOf(p.name)!, unwrap(p.initializer)] as const]
        : ts.isShorthandPropertyAssignment(p)
          ? [[p.name.text, p.name as ts.Expression] as const]
          : [],
    ),
  )
}

function evaluate(node: ts.Expression, where: string, holes: Holes): unknown {
  const e = unwrap(node)
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    return e.text
  }
  if (ts.isNumericLiteral(e)) {
    return Number(e.text)
  }
  if (
    ts.isPrefixUnaryExpression(e) &&
    e.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(e.operand)
  ) {
    return -Number(e.operand.text)
  }
  if (e.kind === ts.SyntaxKind.TrueKeyword) {
    return true
  }
  if (e.kind === ts.SyntaxKind.FalseKeyword) {
    return false
  }
  if (e.kind === ts.SyntaxKind.NullKeyword) {
    return null
  }
  if (ts.isArrayLiteralExpression(e) && !e.elements.some(ts.isSpreadElement)) {
    return e.elements.map((el, i) => evaluate(el, child(where, i), holes))
  }
  if (ts.isObjectLiteralExpression(e)) {
    const props = properties(e)
    if (props.size < e.properties.length) {
      holes.open.push(where)
    }
    const obj = Object.fromEntries(
      [...props].map(([k, v]) => [k, evaluate(v, child(where, k), holes)]),
    )
    if (obj.type === COMPUTED) {
      holes.computed.push(where)
    }
    return obj
  }
  holes.computed.push(where)
  return COMPUTED
}

function written(where: string, holes: Holes) {
  return !(
    holes.open.includes(where) ||
    holes.computed.some(
      w =>
        w === '' ||
        where === w ||
        where.startsWith(`${w}.`) ||
        where.startsWith(`${w}[`),
    )
  )
}

function stringProp(node: ts.ObjectLiteralExpression, key: string) {
  const value = properties(node).get(key)
  return value && ts.isStringLiteralLike(value) ? value.text : undefined
}

function ancestors(node: ts.Node): ts.ObjectLiteralExpression[] {
  const parent = node.parent as ts.Node | undefined
  return parent
    ? [
        ...(ts.isObjectLiteralExpression(parent) ? [parent] : []),
        ...ancestors(parent),
      ]
    : []
}

const configTracks = new Map<string, Obj[]>()
function tracksOf(configPath: string) {
  if (!configTracks.has(configPath)) {
    const config = JSON.parse(
      fs.readFileSync(path.join(root, configPath), 'utf8'),
    ) as { tracks?: Obj[] }
    configTracks.set(configPath, config.tracks ?? [])
  }
  return configTracks.get(configPath)!
}

// The display branches of a view's track entry that may take it. An entry
// naming no display opens the track's declared displays, then its type's, the
// first the view draws; for a track this file cannot find, any branch may.
function entryBranches(view: string, entry: Obj, track: Obj | undefined) {
  const union = defs[`${view}TrackEntry`] as { anyOf?: Obj[] } | undefined
  const branches = (union?.anyOf ?? []).flatMap((b, i) =>
    typeof b.title === 'string'
      ? [
          {
            display: b.title.replace(/TrackEntry$/, ''),
            pointer: `/$defs/${view}TrackEntry/anyOf/${i}`,
          },
        ]
      : [],
  )
  const declared = Array.isArray(track?.displays)
    ? (track.displays as Obj[]).map(d => d.type)
    : []
  const offered =
    configManifest.tracks[canonical(configManifest.tracks, track?.type) ?? '']
      ?.displayTypes ?? []
  const display = (entry.type ? [entry.type] : [...declared, ...offered])
    .map(d => canonical(configManifest.displays, d))
    .find(d => branches.some(b => b.display === d))
  return display ? branches.filter(b => b.display === display) : branches
}

function isTrackConfig(props: Map<string, ts.Expression>) {
  const type = props.get('type')
  return type && ts.isStringLiteralLike(type)
    ? canonical(configManifest.tracks, type.text) !== undefined
    : props.has('trackId') &&
        !props.has('type') &&
        (props.has('adapter') || props.has('uri'))
}

// `{ trackId, displaySnapshot }`, or a `tracks` entry with keys beside its
// trackId, which a session spec folds onto the display
function isSessionEntry(node: ts.ObjectLiteralExpression) {
  const props = properties(node)
  const owner = ts.isArrayLiteralExpression(node.parent)
    ? node.parent.parent
    : undefined
  return (
    props.has('displaySnapshot') ||
    (props.has('trackId') &&
      props.size > 1 &&
      !!owner &&
      ts.isPropertyAssignment(owner) &&
      keyOf(owner.name) === 'tracks')
  )
}

function problemsIn(file: string) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const at = (node: ts.Node) =>
    `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
  const tracks: ts.ObjectLiteralExpression[] = []
  const entries: ts.ObjectLiteralExpression[] = []
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      if (isTrackConfig(properties(node))) {
        tracks.push(node)
      } else if (isSessionEntry(node)) {
        entries.push(node)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  const report: string[] = []
  const fileTracks = new Map<unknown, Obj>()
  for (const node of tracks) {
    const holes: Holes = { computed: [], open: [] }
    const track = evaluate(node, '', holes) as Obj
    fileTracks.set(track.trackId, track)
    for (const p of schemaProblems(track, '/$defs/Track')) {
      if (written(p.where, holes)) {
        report.push(`${at(node)} ${p.where}: ${p.message}`)
      }
    }
  }

  for (const node of entries) {
    const holes: Holes = { computed: [], open: [] }
    const { displaySnapshot, ...inline } = evaluate(node, '', holes) as Obj
    const fold = (w: string) => w.replace(/^displaySnapshot\.?/, '')
    holes.computed = holes.computed.map(fold)
    holes.open = holes.open.map(fold)
    const entry: Obj = { ...inline, ...(displaySnapshot as Obj | undefined) }
    if (entry.type !== undefined) {
      entry.type = canonical(configManifest.displays, entry.type) ?? entry.type
    }
    const view =
      ancestors(node)
        .map(a => canonical(configManifest.views, stringProp(a, 'type')))
        .find(Boolean) ?? 'LinearGenomeView'
    const configPath =
      ancestors(node)
        .map(a => stringProp(a, 'config'))
        .find(Boolean) ??
      (file.startsWith(BROWSER_TESTS) ? BROWSER_TEST_CONFIG : undefined)
    const track =
      fileTracks.get(entry.trackId) ??
      (configPath
        ? tracksOf(configPath).find(t => t.trackId === entry.trackId)
        : undefined)
    const judged = entryBranches(view, entry, track).map(b => ({
      ...b,
      problems: schemaProblems(entry, b.pointer).filter(p =>
        written(p.where, holes),
      ),
    }))
    if (judged.length > 0 && judged.every(j => j.problems.length > 0)) {
      const { display, problems } = judged.sort(
        (a, b) => a.problems.length - b.problems.length,
      )[0]!
      for (const p of problems) {
        report.push(`${at(node)} ${p.where} (as ${display}): ${p.message}`)
      }
    }
  }
  return { report, checked: tracks.length + entries.length }
}

const results = new Map(sources.map(file => [file, problemsIn(file)]))

test.each(sources)('%s', file => {
  expect(results.get(file)!.report).toEqual([])
})

test('every home holds literals the sweep checks', () => {
  const checkedIn = (home: string) =>
    [...results]
      .filter(([file]) => file.startsWith(home))
      .reduce((sum, [, r]) => sum + r.checked, 0)
  for (const home of [
    'products/jbrowse-build-your-own/examples-site/',
    'products/jbrowse-react-app/examples-site/',
    'products/jbrowse-react-linear-genome-view/examples-site/',
    'products/jbrowse-react-circular-genome-view/examples-site/',
    `${BROWSER_TESTS}/suites/`,
    `${BROWSER_TESTS}/probe-`,
  ]) {
    expect([home, checkedIn(home)]).not.toEqual([home, 0])
  }
})
