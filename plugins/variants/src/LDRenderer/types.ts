import type { LDMatrixResult } from '../VariantRPC/getLDMatrix.ts'

export interface LDFlatbushItem {
  i: number // SNP index (row)
  j: number // SNP index (column)
  ldValue: number // LD value (R² or D')
  snp1: LDMatrixResult['snps'][0] // SNP at index i
  snp2: LDMatrixResult['snps'][0] // SNP at index j
}
