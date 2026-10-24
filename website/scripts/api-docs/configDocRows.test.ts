import fs from 'fs'
import path from 'path'

// Every row a config page prints names a path the published JSON schema
// declares. The generator reads JSDoc tags, which can name a nested slot by
// its own name alone; the pages then printed `scale.names` as a root `names`
// and contradicted their own examples. `assertManifestSlotsAreDocumented`
// checks the other direction, and only one level deep.

type Json = Record<string, unknown>

const root = path.resolve(__dirname, '../../..')
const defs = (
  JSON.parse(
    fs.readFileSync(
      path.join(root, 'website/static/schema/v5/config.json'),
      'utf8',
    ),
  ) as { $defs: Record<string, Json> }
).$defs

// a plugin's config lives under the root config's `configuration`, not under
// the schema the page names
const ROOTED_ELSEWHERE = new Set(['LinearGenomeViewConfigSchema'])

function resolved(node: Json | undefined): Json | undefined {
  const ref = node?.$ref
  return typeof ref === 'string' ? defs[ref.split('/').pop()!] : node
}

function pathsOf(node: Json | undefined, prefix: string, out: Set<string>) {
  const x = resolved(node)
  if (!x || prefix.split('.').length > 8) {
    return out
  }
  if (x.else) {
    pathsOf(x.else as Json, prefix, out)
  }
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    for (const branch of (x[key] as Json[] | undefined) ?? []) {
      // a union dispatched on `type` documents each member under its type
      const constType = (
        (branch.if as Json | undefined)?.properties as
          | Record<string, Json>
          | undefined
      )?.type?.const
      if (typeof constType === 'string' && branch.then) {
        pathsOf(branch.then as Json, `${prefix}${constType}.`, out)
      } else {
        pathsOf(branch, prefix, out)
      }
    }
  }
  if (x.items) {
    pathsOf(x.items as Json, prefix, out)
  }
  for (const [key, value] of Object.entries(
    (x.properties as Record<string, Json> | undefined) ?? {},
  )) {
    out.add(`${prefix}${key}`)
    pathsOf(value, `${prefix}${key}.`, out)
  }
  return out
}

const dir = path.join(root, 'website/docs/config')
const pages = fs
  .readdirSync(dir)
  .map(file => file.replace(/\.md$/, ''))
  .filter(
    name => (defs[`${name}Slots`] ?? defs[name]) && !ROOTED_ELSEWHERE.has(name),
  )

test.each(pages)('every row on %s names a declared path', name => {
  const declared = pathsOf(defs[`${name}Slots`] ?? defs[name], '', new Set())
  // a sub-schema page for a slot a track carries prints its rows under that
  // slot's name: FormatAbout's `formatAbout.config`
  const ownKey = `${name[0]!.toLowerCase()}${name.slice(1)}.`
  const rows = [
    ...fs
      .readFileSync(path.join(dir, `${name}.md`), 'utf8')
      .matchAll(/<span id="slot-[^"]*">\*\*([^*]+)\*\*<\/span>/g),
  ].map(m => m[1]!)
  expect(
    rows.filter(
      row =>
        !declared.has(row) &&
        !(row.startsWith(ownKey) && declared.has(row.slice(ownKey.length))),
    ),
  ).toEqual([])
})
