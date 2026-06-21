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

export interface Descriptions {
  INFO?: {
    ANN?: {
      Description?: string
    }
    CSQ?: {
      Description?: string
    }
  }
}
