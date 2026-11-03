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

// Hub configs load this bundle on v4.3.0 as well, and a plugin whose load or
// install throws fails the whole config there. What v4.3.0 serves differently
// from the host this bundle is built against, as far as the bundle reaches.
function v430Host() {
  const {
    '@jbrowse/core/util/lazyWithPreload': _lazy,
    '@jbrowse/core/util/electron': _electron,
    '@jbrowse/core/data_adapters/dataAdapterCache': _cache,
    ...served
  } = hostModules
  const {
    addDisplayMenuItems: _display,
    addViewMenuItems: _view,
    ...elementTypes
  } = served['@jbrowse/core/pluggableElementTypes'] as Record<string, unknown>
  // MUI 7's SvgIcon module exports the component but not `createSvgIcon`
  const { createSvgIcon: _create, ...svgIcon } = served[
    '@mui/material/SvgIcon'
  ] as Record<string, unknown>
  return {
    ...served,
    '@jbrowse/core/pluggableElementTypes': elementTypes,
    '@mui/material/SvgIcon': svgIcon,
  }
}

test('the UMD bundle loads on a v4.3.0 host and installs nothing there', async () => {
  const { bundle } = await buildBundle()
  const pluginManager = install(bundle, v430Host())
  expect(() => pluginManager.getWidgetType('UcscResultsWidget')).toThrow(
    /not registered/,
  )
})
