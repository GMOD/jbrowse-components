import { parseVcfBuffer } from './vcfParser'

describe('parseVcfBuffer', () => {
  it('should parse VCF content with header and variants', () => {
    const vcfContent = `##fileformat=VCFv4.1
##samtoolsVersion=0.1.18
##INFO=<ID=DP,Number=1,Type=Integer,Description="Raw read depth">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
ctgA	1000	.	G	A	60	PASS	DP=30
ctgA	2000	.	C	T	50	PASS	DP=25
ctgB	1500	.	T	G	40	PASS	DP=20
`

    const buffer = new TextEncoder().encode(vcfContent)
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('##fileformat=VCFv4.1\n##samtoolsVersion=0.1.18\n##INFO=<ID=DP,Number=1,Type=Integer,Description="Raw read depth">\n#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO')
    expect(result.featureMap.ctgA).toEqual([
      'ctgA	1000	.	G	A	60	PASS	DP=30',
      'ctgA	2000	.	C	T	50	PASS	DP=25'
    ])
    expect(result.featureMap.ctgB).toEqual([
      'ctgB	1500	.	T	G	40	PASS	DP=20'
    ])
  })

  it('should handle empty content', () => {
    const buffer = new TextEncoder().encode('')
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('')
    expect(result.featureMap).toEqual({})
  })

  it('should handle content with only headers', () => {
    const vcfContent = `##fileformat=VCFv4.1
##samtoolsVersion=0.1.18
##INFO=<ID=DP,Number=1,Type=Integer,Description="Raw read depth">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
`

    const buffer = new TextEncoder().encode(vcfContent)
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('##fileformat=VCFv4.1\n##samtoolsVersion=0.1.18\n##INFO=<ID=DP,Number=1,Type=Integer,Description="Raw read depth">\n#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO')
    expect(result.featureMap).toEqual({})
  })

  it('should handle content with only variants (no headers)', () => {
    const vcfContent = `ctgA	1000	.	G	A	60	PASS	DP=30
ctgA	2000	.	C	T	50	PASS	DP=25
ctgB	1500	.	T	G	40	PASS	DP=20
`

    const buffer = new TextEncoder().encode(vcfContent)
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('')
    expect(result.featureMap.ctgA).toEqual([
      'ctgA	1000	.	G	A	60	PASS	DP=30',
      'ctgA	2000	.	C	T	50	PASS	DP=25'
    ])
    expect(result.featureMap.ctgB).toEqual([
      'ctgB	1500	.	T	G	40	PASS	DP=20'
    ])
  })

  it('should handle file with trailing newline', () => {
    const vcfContent = `##fileformat=VCFv4.1
ctgA	1000	.	G	A	60	PASS	DP=30
`

    const buffer = new TextEncoder().encode(vcfContent)
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('##fileformat=VCFv4.1')
    expect(result.featureMap.ctgA).toEqual(['ctgA	1000	.	G	A	60	PASS	DP=30'])
  })

  it('should handle file without trailing newline', () => {
    const vcfContent = `##fileformat=VCFv4.1
ctgA	1000	.	G	A	60	PASS	DP=30`

    const buffer = new TextEncoder().encode(vcfContent)
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('##fileformat=VCFv4.1')
    expect(result.featureMap.ctgA).toEqual(['ctgA	1000	.	G	A	60	PASS	DP=30'])
  })

  it('should handle empty lines', () => {
    const vcfContent = `##fileformat=VCFv4.1


ctgA	1000	.	G	A	60	PASS	DP=30

ctgB	1500	.	T	G	40	PASS	DP=20

`

    const buffer = new TextEncoder().encode(vcfContent)
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('##fileformat=VCFv4.1')
    expect(result.featureMap.ctgA).toEqual(['ctgA	1000	.	G	A	60	PASS	DP=30'])
    expect(result.featureMap.ctgB).toEqual(['ctgB	1500	.	T	G	40	PASS	DP=20'])
  })

  it('should handle multiple variants for same reference', () => {
    const vcfContent = `##fileformat=VCFv4.1
ctgA	1000	.	G	A	60	PASS	DP=30
ctgA	2000	.	C	T	50	PASS	DP=25
ctgA	3000	.	T	G	40	PASS	DP=20
`

    const buffer = new TextEncoder().encode(vcfContent)
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('##fileformat=VCFv4.1')
    expect(result.featureMap.ctgA).toEqual([
      'ctgA	1000	.	G	A	60	PASS	DP=30',
      'ctgA	2000	.	C	T	50	PASS	DP=25',
      'ctgA	3000	.	T	G	40	PASS	DP=20'
    ])
  })

  it('should call status callback during parsing', () => {
    const vcfContent = `##fileformat=VCFv4.1
ctgA	1000	.	G	A	60	PASS	DP=30
`

    const buffer = new TextEncoder().encode(vcfContent)
    const mockStatusCallback = jest.fn()
    
    parseVcfBuffer(buffer, mockStatusCallback)

    expect(mockStatusCallback).toHaveBeenCalledWith(expect.stringContaining('Loading'))
  })

  it('should handle whitespace-only lines', () => {
    const vcfContent = `##fileformat=VCFv4.1
   
	
ctgA	1000	.	G	A	60	PASS	DP=30
`

    const buffer = new TextEncoder().encode(vcfContent)
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('##fileformat=VCFv4.1')
    expect(result.featureMap.ctgA).toEqual(['ctgA	1000	.	G	A	60	PASS	DP=30'])
  })

  it('should handle single line file without newline', () => {
    const vcfContent = `ctgA	1000	.	G	A	60	PASS	DP=30`

    const buffer = new TextEncoder().encode(vcfContent)
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('')
    expect(result.featureMap.ctgA).toEqual(['ctgA	1000	.	G	A	60	PASS	DP=30'])
  })

  it('should handle complex VCF with multiple types of header lines', () => {
    const vcfContent = `##fileformat=VCFv4.1
##contig=<ID=ctgA,length=50001>
##contig=<ID=ctgB,length=6079>
##INFO=<ID=DP,Number=1,Type=Integer,Description="Raw read depth">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	sample1
ctgA	1000	.	G	A	60	PASS	DP=30	GT	0/1
ctgB	2000	rs123	C	T	50	PASS	DP=25	GT	1/1
`

    const buffer = new TextEncoder().encode(vcfContent)
    const result = parseVcfBuffer(buffer)

    expect(result.header).toBe('##fileformat=VCFv4.1\n##contig=<ID=ctgA,length=50001>\n##contig=<ID=ctgB,length=6079>\n##INFO=<ID=DP,Number=1,Type=Integer,Description="Raw read depth">\n##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">\n#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	sample1')
    expect(result.featureMap.ctgA).toEqual(['ctgA	1000	.	G	A	60	PASS	DP=30	GT	0/1'])
    expect(result.featureMap.ctgB).toEqual(['ctgB	2000	rs123	C	T	50	PASS	DP=25	GT	1/1'])
  })
})