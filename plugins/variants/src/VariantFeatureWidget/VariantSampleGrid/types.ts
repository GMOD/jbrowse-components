export interface FrequencyTableEntry {
  count: number
  GT: string
  genotype: string
}

export type FrequencyTable = Record<string, FrequencyTableEntry>

export interface AlleleFrequency {
  id: string
  allele: string
  count: number
  frequency: string
}

export interface VariantSampleGridRow {
  sample: string
  id: string
  GT: string
  genotype: string
  [key: string]: string
}

export type InfoFields = Record<string, unknown[]>
export type Filters = Record<string, string>

export interface VariantFieldDescriptions {
  FORMAT?: Record<string, { Description?: string }>
}
