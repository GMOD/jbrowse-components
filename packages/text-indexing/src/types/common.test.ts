import { isSupportedIndexingAdapter } from '@jbrowse/core/util'
import { guessAdapterFromFileName, isURL, makeLocation } from './common'

describe('utils for text indexing', () => {
  const local = './volvox.sort.gff3.gz'
  const gff =
    'https://jbrowse.org/genomes/CHM13/genes/chm13.draft_v1.1.gene_annotation.v4.sorted.gff.gz'
  const gff3 =
    'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/gencode/gencode.v36.annotation.sort.gff3.gz'
  const vcf =
    'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz'
  const unsupported =
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/amplicon_deep_seq/out.marked.bam'
  it('test isURL', () => {
    const test1_result = isURL(local)
    const test2_result = isURL(gff3)
    expect(test1_result).toBe(false)
    expect(test2_result).toBeTruthy()
  })
  it('test makeLocation', () => {
    const location1 = makeLocation(local, 'localPath')
    const location2 = makeLocation(gff3, 'uri')
    expect(location1.locationType).toBe('LocalPathLocation')
    expect(location2.locationType).toBe('UriLocation')
  })
  it('test guess adapter from file name', () => {
    const conf1 = guessAdapterFromFileName(gff3)
    expect(conf1.adapter?.type).toBe('Gff3TabixAdapter')
    expect(isSupportedIndexingAdapter(conf1.adapter?.type)).toBe(true)
    const conf2 = guessAdapterFromFileName(gff)
    expect(conf2.adapter?.type).toBe('Gff3TabixAdapter')
    const conf3 = guessAdapterFromFileName(vcf)
    expect(conf3.adapter?.type).toBe('VcfTabixAdapter')
    expect(() => {
      guessAdapterFromFileName(unsupported)
    }).toThrow(`Unsupported file type ${unsupported}`)
  })
})
