import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export interface VCFFeatureSerialized extends SimpleFeatureSerialized {
  ALT?: string[]
  REF?: string
  INFO?: {
    CHR2?: (string | number | undefined)[]
    END?: (string | number | undefined)[]
  } & Record<string, (string | number | undefined)[] | boolean>
  mate?: { refName: string; start: number; end?: number }
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

export interface ReducedFeature {
  INFO?: {
    ANN?: string[]
    CSQ?: string[]
  }
}
