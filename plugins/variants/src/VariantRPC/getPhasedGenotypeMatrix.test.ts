// Note: These tests would require mocking the adapter infrastructure.
// Below are test cases that describe expected behavior.

describe('getPhasedGenotypeMatrix', () => {
  // Test case descriptions for expected behavior:

  test.todo('creates row for each haplotype based on maxPloidy')
  // Given sources: [{name: 'HG001'}, {name: 'HG002'}]
  // And sampleInfo: {HG001: {maxPloidy: 2}, HG002: {maxPloidy: 2}}
  // Matrix should have keys: ['HG001 HP0', 'HG001 HP1', 'HG002 HP0', 'HG002 HP1']

  test.todo('uses actual allele numbers for phased genotypes')
  // Given genotype '0|1' for a variant
  // HG001 HP0 should have value 0
  // HG001 HP1 should have value 1

  test.todo('handles multi-allelic variants')
  // Given genotype '1|2' for a variant
  // HG001 HP0 should have value 1
  // HG001 HP1 should have value 2

  test.todo('treats unphased genotypes as missing (-1)')
  // Given genotype '0/1' (unphased, using /)
  // HG001 HP0 should have value -1
  // HG001 HP1 should have value -1

  test.todo('treats uncalled alleles as missing (-1)')
  // Given genotype '.|1'
  // HG001 HP0 should have value -1
  // HG001 HP1 should have value 1

  test.todo('handles variable ploidy across samples')
  // Given sampleInfo: {HG001: {maxPloidy: 2}, HG002: {maxPloidy: 3}}
  // Matrix should have 5 rows total
})

// Example of what a full integration test might look like:
// describe('getPhasedGenotypeMatrix integration', () => {
//   test('builds correct matrix from VCF features', async () => {
//     const mockFeature = {
//       get: (key: string) => {
//         if (key === 'genotypes') {
//           return {
//             'HG001': '0|1',
//             'HG002': '1|0',
//           }
//         }
//       }
//     }
//     // ... setup mock adapter that returns mockFeature
//     // ... call getPhasedGenotypeMatrix
//     // ... assert matrix values
//   })
// })
