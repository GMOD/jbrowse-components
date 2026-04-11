import PluginManager from '@jbrowse/core/PluginManager'
import { getConfSnapshot } from '@jbrowse/core/configuration'

import configSchemaFactory from './configSchema.ts'

function createPluginManager() {
  const pm = new PluginManager([])
  pm.createPluggableElements()
  pm.configure()
  return pm
}

describe('LinearBasicDisplay configSchema', () => {
  const pm = createPluginManager()
  const schema = configSchemaFactory(pm)

  it('getConfSnapshot includes all DisplayConfig rendering fields', () => {
    const config = schema.create(
      { displayId: 'test', type: 'LinearBasicDisplay' },
      { pluginManager: pm },
    )
    const snap = getConfSnapshot(config)

    expect(snap.color1).toBe('goldenrod')
    expect(snap.color2).toBe('#f0f')
    expect(snap.color3).toBe('#357089')
    expect(snap.featureHeight).toBe(10)
    expect(snap.displayMode).toBe('normal')
    expect(snap.geneGlyphMode).toBe('auto')
    expect(snap.subfeatureLabels).toBe('none')
    expect(snap.displayDirectionalChevrons).toBe(true)
    expect(snap.transcriptTypes).toEqual([
      'mRNA',
      'transcript',
      'primary_transcript',
    ])
    expect(snap.containerTypes).toEqual(['proteoform_orf'])
  })
})
