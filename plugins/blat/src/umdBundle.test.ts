/**
 * @jest-environment node
 */
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import hostModules from '@jbrowse/core/ReExports/modules'
import * as esbuild from 'esbuild'

import { umdBuildOptions, umdBundleProblems } from '../scripts/umdBuild.ts'

import type { PluginConstructor } from '@jbrowse/core/Plugin'

// The repo's one runtime-plugin build, run against the registry a host
// serves. A change to how a module is served, such as a lazy component in
// place of the module or a default the bundle's interop misreads, fails here
// and nowhere tsc looks.
test('the UMD bundle loads and installs against the host it was built for', async () => {
  const result = await esbuild.build({
    ...umdBuildOptions(path.join(__dirname, '..')),
    write: false,
    logLevel: 'silent',
  })
  const bundle = result.outputFiles[0]!.text
  expect(
    umdBundleProblems(Object.keys(result.metafile.inputs), bundle),
  ).toEqual([])

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const plugin = new Function(
    'JBrowseExports',
    `${bundle}; return JBrowsePluginBlat`,
  )(hostModules) as { default: PluginConstructor }
  const pluginManager = new PluginManager([
    new plugin.default(),
  ]).createPluggableElements()
  expect(pluginManager.getWidgetType('UcscResultsWidget')).toBeDefined()
})
