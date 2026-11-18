import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

import { VARIANT_FEATURE_WIDGET } from '../shared/constants.ts'
import configSchemaF from './configSchema.ts'
import { stringifyVCF } from './saveTrackFormats/vcf.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function VariantTrackF(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      name: 'VariantTrack',
      displayName: 'Variant track',
      featureWidget: VARIANT_FEATURE_WIDGET,
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
