export interface FrequencyTableEntry {
  count: number
  GT: string
  genotype: string | undefined
}

export type FrequencyTable = Record<string, FrequencyTableEntry>
