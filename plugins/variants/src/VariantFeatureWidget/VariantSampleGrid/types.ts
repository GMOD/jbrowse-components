export interface FrequencyTableEntry {
  count: number
  GT: string
  genotype: string | undefined
}

export type FrequencyTable = Record<string, FrequencyTableEntry>

export interface VariantSampleGridRow {
  sample: string
  id: string
  GT: string
  [key: string]: string
}

export type InfoFields = Record<string, unknown[]>
export type Filters = Record<string, string>

interface FormatRecord {
  Description?: string
}
export interface VariantFieldDescriptions {
  FORMAT?: Record<string, FormatRecord>
}
