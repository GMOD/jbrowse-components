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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { unservedReads } from './pluginHostReads.ts'

import type { AbiManifest } from './pluginHostReads.ts'

const dir = join(import.meta.dirname, '../packages/core/src/ReExports')
const read = (f: string) =>
  JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown

const manifest = read('reExports.generated.json') as AbiManifest
const pluginReads = read('publishedPluginReads.json') as Record<
  string,
  string[]
>

const broken = Object.entries(pluginReads)
  .map(([plugin, reads]) => ({
    plugin,
    gone: unservedReads(reads, manifest),
  }))
  .filter(r => r.gone.length > 0)

if (broken.length > 0) {
  console.error('A published plugin reads a name this ABI no longer serves:')
  for (const { plugin, gone } of broken) {
    console.error(`  ${plugin}: ${gone.join(', ')}`)
  }
  console.error(
    '\nThe name is undefined inside the bundle the store already serves. Keep ' +
      'serving it, or release the plugin without the read and refresh the ' +
      'list with `pnpm check-published-plugins --write`.',
  )
  process.exit(1)
}
