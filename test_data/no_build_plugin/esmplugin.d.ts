// Types for esmplugin.js, which cannot carry its own.
//
// That file IS the "Complete example" published in
// website/docs/developer_guides/no_build_plugin.md — the guide's code fences
// are generated from it by `<!-- include: -->` — and the whole point of the
// example is a plugin with no build step, so annotating it would both change
// the published guide and contradict what it teaches.
//
// PluginLoader.test.ts imports it to prove a real no-build plugin installs
// through jbrequire (the half of the ABI a unit test on the loader cannot
// see). Without this declaration that import is TS7016, which failed
// `pnpm typecheck` on a clean checkout.
//
// PluginConstructor is what PluginLoader's `fetchESM` returns as
// `LoadedPlugin['default']`, so this asserts exactly the contract the test is
// there to check.
import type { PluginConstructor } from '../../packages/core/src/Plugin.ts'

declare const MyPlugin: PluginConstructor
export default MyPlugin
