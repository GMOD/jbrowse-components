import PluginManager from '@jbrowse/core/PluginManager'
import SimpleFeature, {
  buildJexlContext,
} from '@jbrowse/core/util/simpleFeature'

import VariantsPlugin from '../index.ts'
import { VARIANT_FILTER_EXAMPLES } from './variantFilterExamples.ts'

// The dialog's examples are the only documentation of what a VCF filter may
// read, so an example naming a function nobody registered — or a field the
// parser spells differently — teaches an expression that fails inside the
// worker, where the user sees an errored track and no hint about which line.
const pluginManager = new PluginManager([new VariantsPlugin()])
pluginManager.createPluggableElements()
pluginManager.configure()

const feature = new SimpleFeature({
  uniqueId: 'v1',
  refName: 'chr1',
  start: 100,
  end: 101,
  type: 'SNV',
  QUAL: 55,
  FILTER: ['PASS'],
  REF: 'A',
  ALT: ['G'],
  INFO: {
    DP: [30],
    AF: [0.02],
    // missense on one transcript, stop_gained on another — the record whose
    // consequence filter is easy to write wrongly
    CSQ: [
      'G|missense_variant|MODERATE|BRCA1|ENST00000357654',
      'G|stop_gained&NMD_transcript_variant|HIGH|BRCA1|ENST00000468300',
    ],
  },
  genotypes: { s0: '0|1', s1: '1/1', s2: './.' },
})

test.each(VARIANT_FILTER_EXAMPLES.map(e => [e.code] as const))(
  '%s evaluates against a VCF feature',
  code => {
    const expr = pluginManager.jexl.compile(code.replace('jexl:', ''))
    expect(() => expr.eval(buildJexlContext({ feature }))).not.toThrow()
  },
)

test('the consequence example sees a transcript that is not the most severe', () => {
  const code = "'missense_variant' in consequences(feature)"
  const value = pluginManager.jexl
    .compile(code)
    .eval(buildJexlContext({ feature }))
  expect(value).toBe(true)
  // the two spellings it exists to replace, both silently false
  for (const wrong of [
    "consequence(feature) == 'missense_variant'",
    "includes(feature.INFO.CSQ, 'missense_variant')",
  ]) {
    expect(
      pluginManager.jexl.compile(wrong).eval(buildJexlContext({ feature })),
    ).toBe(false)
  }
})

test('the examples are what the filter dialog would keep', () => {
  for (const { code, description } of VARIANT_FILTER_EXAMPLES) {
    expect(code.startsWith('jexl:')).toBe(true)
    expect(code.trim()).toBe(code)
    expect(description).not.toBe('')
  }
})
