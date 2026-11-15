import type { Descriptors } from '@jbrowse/core/BaseFeatureWidget'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export interface VCFFeatureSerialized extends SimpleFeatureSerialized {
  ALT?: string[]
  REF?: string
  INFO?: {
    CHR2?: (string | number | undefined)[]
    END?: (string | number | undefined)[]
    ANN?: string[]
    CSQ?: string[]
  } & Record<string, (string | number | undefined)[] | boolean | undefined>
  samples?: Record<string, Record<string, unknown[]>>
  genotypes?: Record<string, string>
  clickedSample?: string
  clickedGenotype?: string
  clickedAlleles?: string
}

// VCF header metadata (@gmod/vcf `getMetadata()`, fetched via CoreGetMetadata),
// narrowed to the per-field Description maps: INFO and FORMAT feed the ANN/CSQ
// column lists and the sample-grid column tooltips, and ALT and FILTER, which
// @gmod/vcf seeds with the reserved types, sit where the column names'
// own descriptions go.
type FieldDescriptions = Record<string, { Description?: string } | undefined>

export interface Descriptions extends Descriptors {
  INFO?: FieldDescriptions
  FORMAT?: FieldDescriptions
  ALT?: FieldDescriptions
  FILTER?: FieldDescriptions
}
