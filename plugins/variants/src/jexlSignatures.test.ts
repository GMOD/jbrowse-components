import fs from 'node:fs'
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import { jexlProblems } from '@jbrowse/core/util/jexlDiagnostics'

import VariantsPlugin from './index.ts'
import { VARIANT_FILTER_EXAMPLES } from './shared/variantFilterExamples.ts'

const pluginManager = new PluginManager([new VariantsPlugin()])
pluginManager.createPluggableElements()
pluginManager.configure()
const { jexl } = pluginManager

// The catalog is generated from every #jexlFunction tag, core's and this
// plugin's, so it is each function's documented use. A signature stricter
// than that use would mark the documentation itself wrong in the filter
// dialog.
function catalogExamples() {
  const doc = fs.readFileSync(
    path.resolve(__dirname, '../../../website/docs/config_guides/jexl.md'),
    'utf8',
  )
  const catalog =
    /<!-- BEGIN GENERATED JEXL_CATALOG -->([\s\S]*?)<!-- END GENERATED JEXL_CATALOG -->/.exec(
      doc,
    )![1]!
  return (
    [...catalog.matchAll(/^jexl: (.*?)(?: \/\/ .*)?$/gm)]
      .map(match => match[1]!)
      // registered by the sv-inspector plugin, which this one doesn't load
      .filter(example => !example.startsWith('defaultOnChordClick'))
  )
}

test('the catalog lists the functions', () => {
  expect(catalogExamples().length).toBeGreaterThan(40)
})

test.each(catalogExamples())('the catalog example %s checks clean', code => {
  expect(jexlProblems(code, jexl)).toEqual([])
})

test.each(VARIANT_FILTER_EXAMPLES.map(e => e.code))(
  'the filter example %s checks clean',
  code => {
    expect(jexlProblems(code, jexl)).toEqual([])
  },
)

test('a call with the wrong argument count is an error', () => {
  expect(jexlProblems('maf(feature, 1)', jexl)).toEqual([
    { severity: 'error', message: 'maf takes 1 argument, not 2' },
  ])
  expect(jexlProblems("substring(feature.name) == 'BR'", jexl)).toEqual([
    {
      severity: 'error',
      message: 'substring takes 2 to 3 arguments, not 1',
    },
  ])
  expect(jexlProblems('genotypeCount(feature) > 0', jexl)).toEqual([
    { severity: 'error', message: 'genotypeCount takes 2 arguments, not 1' },
  ])
})
