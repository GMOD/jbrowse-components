import PluginManager from '@jbrowse/core/PluginManager'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import configSchemaF from './configSchema'

import { stringifyVCF } from './saveTrackFormats/vcf'

export default (pm: PluginManager) => {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      name: 'VariantTrack',
      displayName: 'Variant track',
      configSchema,
      stateModel: createBaseTrackModel(pm, 'VariantTrack', configSchema).views(
        () => ({
          saveTrackFileFormatOptions() {
            return {
              vcf: {
                name: 'VCF',
                extension: 'vcf',
                callback: stringifyVCF,
              },
            }
          },
        }),
      ),
    })
  })
}
