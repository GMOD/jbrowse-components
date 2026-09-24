import PluginManager from '@jbrowse/core/PluginManager'
import { fullConfSnapshot } from '@jbrowse/core/configuration'
import { GENE_GLYPH_DEFAULTS } from '@jbrowse/plugin-canvas'

import configSchemaF from './configSchema.ts'

// A VCF record is one box, so the settings that shape a gene's isoforms,
// subparts, UTRs and intron chevrons are noise in its config editor.
test('a variant display carries none of the gene-glyph slots', () => {
  const pm = new PluginManager([])
  pm.createPluggableElements()
  pm.configure()
  const conf = configSchemaF(pm).create(
    { displayId: 'test', type: 'LinearVariantDisplay' },
    { pluginManager: pm },
  )
  const slots = Object.keys(fullConfSnapshot(conf))
  for (const gene of [
    ...Object.keys(GENE_GLYPH_DEFAULTS),
    'geneGlyphMode',
    'displayDirectionalChevrons',
  ]) {
    expect(slots).not.toContain(gene)
  }
  expect(slots).toContain('featureHeight')
})
