// Assert that a config.json is one JBrowse would actually load, using the same
// checker `jbrowse validate` runs.
//
// Two kinds of caller, which is what `--schema-only` selects between.
//
// A build script under scripts/ is what a tutorial's "Reproduce it end to end"
// hands a reader, and it can exit 0 having written a config that is wrong in
// ways nothing else notices: a display slot the type does not declare is
// ignored at runtime rather than refused, so a track just quietly renders with
// schema defaults. The docs get this checked by check-config-blocks, which
// reads the JSON *in the markdown*; this is the same guarantee for the JSON a
// script generates, which no reader ever sees until it is already open. For
// those the local files the config names are checked too, since the schema
// checker cannot know about them: a `uri` is just a string to it, and a script
// that builds a track but forgets to copy the data in produces a config that
// validates and then draws an empty track.
//
// The demo configs `pnpm check-docs` runs this over are the other kind. Their
// data sits beside the DEPLOYED config in S3, not beside the repo copy, so
// every relative `uri` in one is legitimately absent here — hence
// `--schema-only`, which asks the schema question alone.
//
// Run: node scripts/validate-built-config.ts [--schema-only] <config.json>...
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { validateConfig } from '../products/jbrowse-cli/src/commands/validate/validateConfig.ts'

const { values, positionals } = parseArgs({
  options: { 'schema-only': { type: 'boolean' } },
  allowPositionals: true,
  strict: true,
})

if (positionals.length === 0) {
  console.error(
    'usage: validate-built-config.ts [--schema-only] <config.json>...',
  )
  process.exit(2)
}

// Every `uri` that is not a url has to resolve next to the config, since that
// is where the app will look for it.
function missingLocalUris(path: string, config: unknown) {
  const missing: string[] = []
  function walk(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(walk)
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'uri' && typeof v === 'string' && !v.includes('://')) {
          const abs = isAbsolute(v) ? v : resolve(dirname(path), v)
          if (!existsSync(abs)) {
            missing.push(v)
          }
        } else {
          walk(v)
        }
      }
    }
  }
  walk(config)
  return missing
}

function validate(path: string) {
  if (!existsSync(path)) {
    console.error(`no config at ${path} — the script did not get that far`)
    return false
  }
  const config = JSON.parse(readFileSync(path, 'utf8')) as Record<
    string,
    unknown
  >
  const { problems, errorCount } = validateConfig(config)
  for (const p of problems) {
    console.error(`${p.level} ${p.where}: ${p.message}`)
  }
  const missing = values['schema-only'] ? [] : missingLocalUris(path, config)
  for (const m of missing) {
    console.error(`missing file: ${m} is named by the config but not beside it`)
  }
  if (errorCount || missing.length) {
    console.error(
      `\n${path}: ${errorCount} schema error(s), ${missing.length} missing file(s)`,
    )
    return false
  }
  const assemblies = Array.isArray(config.assemblies) ? config.assemblies : []
  const tracks = Array.isArray(config.tracks) ? config.tracks : []
  // Bound to its own name rather than inlined next to a `+`: as an operand of a
  // concatenation the ternary takes the whole string as its condition, which is
  // always truthy, and the line then reports a default session on every config.
  const session = config.defaultSession
    ? 'a default session'
    : 'no default session'
  console.log(
    `${path}: ok — ${assemblies.length} assembly/assemblies, ${tracks.length} track(s), ${session}`,
  )
  return true
}

const failed = positionals.filter(path => !validate(path))
if (failed.length) {
  process.exit(1)
}
