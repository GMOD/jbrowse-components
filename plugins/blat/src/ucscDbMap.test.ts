import { assemblyToUcscDb } from './ucscDbMap.ts'

test('maps common GRC/T2T assembly names to UCSC db ids', () => {
  expect(assemblyToUcscDb('GRCh38')).toBe('hg38')
  expect(assemblyToUcscDb('GRCh37')).toBe('hg19')
  expect(assemblyToUcscDb('T2T-CHM13v2.0')).toBe('hs1')
})

test('passes literal UCSC db ids through unchanged', () => {
  expect(assemblyToUcscDb('hg38')).toBe('hg38')
  expect(assemblyToUcscDb('mm39')).toBe('mm39')
})

// GenArk assemblies are queried by their accession: UCSC hgBlat/hgPcr accept it
// as the db and route to their dynamic BLAT servers, so the accession just needs
// to pass through untouched
test('passes GenArk accessions through unchanged', () => {
  expect(assemblyToUcscDb('GCF_000001405.40')).toBe('GCF_000001405.40')
  expect(assemblyToUcscDb('GCA_009914755.4')).toBe('GCA_009914755.4')
})
