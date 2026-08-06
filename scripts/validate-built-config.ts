// Assert that a config.json a build script just wrote is one JBrowse would
// actually load, using the same checker `jbrowse validate` runs.
//
// The build scripts under scripts/ are what a tutorial's "Reproduce it end to
// end" hands a reader, and they can exit 0 having written a config that is
// wrong in ways nothing else notices: a display slot the type does not declare
// is ignored at runtime rather than refused, so a track just quietly renders
// with schema defaults. The docs get this checked by check-config-blocks, which
// reads the JSON *in the markdown*; this is the same guarantee for the JSON a
// script generates, which no reader ever sees until it is already open.
//
// Also checks the local files the config names are actually beside it, which
// the schema checker cannot know about: a `uri` is just a string to it, and a
// script that builds a track but forgets to copy the data in produces a config
// that validates and then draws an empty track.
//
// Run: node scripts/validate-built-config.ts <config.json>
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

import { validateConfig } from '../products/jbrowse-cli/src/commands/validate/validateConfig.ts'

const path = process.argv[2]
if (!path) {
  console.error('usage: validate-built-config.ts <config.json>')
  process.exit(2)
}
if (!existsSync(path)) {
  console.error(`no config at ${path} — the script did not get that far`)
  process.exit(1)
}

const config = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
const { problems, errorCount } = validateConfig(config)

for (const p of problems) {
  console.error(`${p.severity ?? 'error'} ${p.path ?? ''}: ${p.message}`)
}

// Every `uri` that is not a url has to resolve next to the config, since that
// is where the app will look for it.
const missing: string[] = []
function checkLocalUris(node: unknown) {
  if (Array.isArray(node)) {
    node.forEach(checkLocalUris)
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'uri' && typeof v === 'string' && !v.includes('://')) {
        const abs = isAbsolute(v) ? v : resolve(dirname(path), v)
        if (!existsSync(abs)) {
          missing.push(v)
        }
      } else {
        checkLocalUris(v)
      }
    }
  }
}
checkLocalUris(config)
for (const m of missing) {
  console.error(`missing file: ${m} is named by the config but not beside it`)
}

const assemblies = Array.isArray(config.assemblies) ? config.assemblies : []
const tracks = Array.isArray(config.tracks) ? config.tracks : []
if (errorCount || missing.length) {
  console.error(
    `\n${path}: ${errorCount} schema error(s), ${missing.length} missing file(s)`,
  )
  process.exit(1)
}
// Bound to its own name rather than inlined next to a `+`: as an operand of a
// concatenation the ternary takes the whole string as its condition, which is
// always truthy, and the line then reports a default session on every config.
const session = config.defaultSession
  ? 'a default session'
  : 'no default session'
console.log(
  `${path}: ok — ${assemblies.length} assembly/assemblies, ${tracks.length} track(s), ${session}`,
)
