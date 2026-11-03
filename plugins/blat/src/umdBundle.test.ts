/**
 * @jest-environment node
 */
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import hostModules from '@jbrowse/core/ReExports/modules'
import * as esbuild from 'esbuild'

import { umdBuildOptions, umdBundleProblems } from '../scripts/umdBuild.ts'

import type { PluginConstructor } from '@jbrowse/core/Plugin'

async function buildBundle() {
  const result = await esbuild.build({
    ...umdBuildOptions(path.join(__dirname, '..')),
    write: false,
    logLevel: 'silent',
  })
  return {
    bundle: result.outputFiles[0]!.text,
    inputs: Object.keys(result.metafile.inputs),
  }
}

function install(bundle: string, host: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const plugin = new Function(
    'JBrowseExports',
    `${bundle}; return JBrowsePluginBlat`,
  )(host) as { default: PluginConstructor }
  return new PluginManager([new plugin.default()]).createPluggableElements()
}

// The repo's one runtime-plugin build, run against the registry a host
// serves. A change to how a module is served, such as a lazy component in
// place of the module or a default the bundle's interop misreads, fails here
// and nowhere tsc looks.
test('the UMD bundle loads and installs against the host it was built for', async () => {
  const { bundle, inputs } = await buildBundle()
  expect(umdBundleProblems(inputs, bundle)).toEqual([])
  expect(
    install(bundle, hostModules).getWidgetType('UcscResultsWidget'),
  ).toBeDefined()
})

// Hub configs load this bundle on v4.3.0 as well, which serves neither menu
// helper, and a plugin whose install throws fails the whole config there. The
// launch items are what such a host goes without; the dialogs are not.
test('the UMD bundle still installs on a host without the menu helpers', async () => {
  const { bundle } = await buildBundle()
  const key = '@jbrowse/core/pluggableElementTypes'
  const {
    addDisplayMenuItems: _display,
    addViewMenuItems: _view,
    ...older
  } = hostModules[key] as Record<string, unknown>
  expect(
    install(bundle, { ...hostModules, [key]: older }).getWidgetType(
      'UcscResultsWidget',
    ),
  ).toBeDefined()
})
