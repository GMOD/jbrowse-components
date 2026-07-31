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
// narrowed to what the widget reads: the per-field Description strings it uses
// for the ANN/CSQ column lists and the sample-grid column tooltips.
type FieldDescriptions = Record<string, { Description?: string } | undefined>

export type Descriptions = {
  INFO?: FieldDescriptions
  FORMAT?: FieldDescriptions
}
