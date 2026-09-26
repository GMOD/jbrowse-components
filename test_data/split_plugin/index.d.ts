// Types for index.js, which is deliberately plain JS: it stands in for what a
// plugin's esbuild `splitting: true` build emits, and a bundler's output
// carries no annotations. `splitRuntimePlugin.test.ts` imports it, so without
// this the import is TS7016 and `pnpm typecheck` fails on a clean checkout —
// the same reason no_build_plugin carries one.
//
// PluginConstructor is what `fetchESM` hands back as `LoadedPlugin['default']`,
// which is the contract the test is there to check.
import type { PluginConstructor } from '../../packages/core/src/Plugin.ts'

declare const SplitPlugin: PluginConstructor
export default SplitPlugin
