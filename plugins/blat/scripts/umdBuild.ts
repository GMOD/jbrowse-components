/**
 * The UMD bundle an external JBrowse loads at runtime, the same way
 * jbrowse-plugin-mafviewer and friends are loaded — a `plugins` entry in a
 * config, rather than a corePlugins import at build time. That is what lets a
 * hosted JBrowse (jb2hubs' hub configs, say) offer BLAT without shipping it in
 * the web bundle everyone downloads.
 *
 * The contract with `PluginLoader`:
 * - the global is `JBrowsePlugin` + the config's plugin `name`, so a config
 *   entry of `{ name: 'Blat', url }` needs `globalName: 'JBrowsePluginBlat'`;
 * - that global's `.default` is the plugin class;
 * - anything JBrowse re-exports on `JBrowseExports` must NOT be bundled. Two
 *   copies of React or MST in one page is not a size problem, it is a broken
 *   page. Core's `hostShim` binds each such import to the host's copy, and
 *   fails the build on a name the host does not serve.
 */
import { join } from 'node:path'

import { hostShim } from '@jbrowse/core/ReExports/hostShim'

import type { BuildOptions } from 'esbuild'

export const umdBuildOptions = (pluginRoot: string) =>
  ({
    entryPoints: [join(pluginRoot, 'src/index.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'JBrowsePluginBlat',
    platform: 'browser',
    target: 'es2020',
    // without this, bundled MUI code keeps its dev-only propType and warning
    // branches, which both bloat the bundle and log into a production console
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [hostShim({ pluginName: 'Blat' })],
    metafile: true,
  }) satisfies BuildOptions

// A second copy of something whose IDENTITY the host relies on: React (one
// renderer, one hook dispatcher), MobX/MST (a second copy shares no reactivity
// and recognizes none of the host's types), @jbrowse/core. The four
// `@mui/icons-material` files are bundled, since the host serves no icons, and
// draw through the host's `createSvgIcon`, so they take its theme.
const HOST_OWNED =
  /node_modules\/(react|react-dom|mobx|mobx-react|mobx-state-tree)\/|@jbrowse\/mobx-state-tree\/|packages\/core\/src\//

/** What is wrong with a built bundle that no one would see by eye. */
export function umdBundleProblems(inputs: string[], bundle: string) {
  const duplicated = inputs.filter(input => HOST_OWNED.test(input))
  return [
    ...(duplicated.length > 0
      ? [
          `bundled ${duplicated.length} module(s) the host already provides, which would run a second copy alongside JBrowse's:\n  ${duplicated.slice(0, 10).join('\n  ')}`,
        ]
      : []),
    // the loader reads globalThis[`JBrowsePlugin${name}`], so the name in a
    // config's plugins entry has to be `Blat` for this bundle to be findable
    ...(bundle.startsWith('"use strict";var JBrowsePluginBlat=')
      ? []
      : ['bundle does not define the JBrowsePluginBlat global']),
    ...(bundle.includes('window.JBrowseExports')
      ? [
          'bundle reads window.JBrowseExports, which does not exist in the RPC worker',
        ]
      : []),
  ]
}
