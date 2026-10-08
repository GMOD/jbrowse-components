// Fails when this build's plugin ABI stops serving a name a published store
// plugin reads. Offline: both sides are committed, so it runs in `pnpm autogen
// --check` on every push, where check-published-plugins.ts needs the network
// and runs weekly.
//
// jbrowse-components d8db736896 dropped `DisplayStatusChrome` from
// display-kit/DisplayChrome as dead code, and graphgenomeviewer had read it
// for two weeks. The name was `undefined` inside the published bundle, so every
// graph track on the main build failed with React error #130.
//
// publishedPluginReads.json is as fresh as the last `pnpm
// check-published-plugins --write`; a plugin published since is not in it.
//
// acceptedPluginReadRemovals.json is the way to remove a read name on purpose:
// `"module#name": "why"`. The plugin stays broken on this build until it
// releases without the read, and the entry then fails here as stale.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { gatePluginReads } from './pluginHostReads.ts'

import type { AbiManifest } from './pluginHostReads.ts'

const dir = join(import.meta.dirname, '../packages/core/src/ReExports')
const read = (f: string) =>
  JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown
const ACCEPTED = 'acceptedPluginReadRemovals.json'

const { broken, stale } = gatePluginReads(
  read('publishedPluginReads.json') as Record<string, string[]>,
  read('reExports.generated.json') as AbiManifest,
  read(ACCEPTED) as Record<string, string>,
)

if (broken.length > 0) {
  console.error('A published plugin reads a name this ABI no longer serves:')
  for (const { plugin, gone } of broken) {
    console.error(`  ${plugin}: ${gone.join(', ')}`)
  }
  console.error(
    `\nThe name is undefined inside the bundle the store already serves. Keep serving it, or add it to ${ACCEPTED} with the reason if the plugin has to break.`,
  )
}
if (stale.length > 0) {
  console.error(
    `${ACCEPTED} excuses a removal no published plugin is broken by; delete: ${stale.join(', ')}`,
  )
}
if (broken.length > 0 || stale.length > 0) {
  process.exit(1)
}
