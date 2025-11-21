import { describe, expect, it, vi } from 'vitest'

import { parseGffBuffer } from './gffParser'

describe('parseGffBuffer', () => {
  it('should parse GFF3 content with header and features', () => {
    const gffContent = `##gff-version 3
# This is a comment
##sequence-region ctgA 1 50001
ctgA	example	contig	1	50001	.	.	.	Name=ctgA
ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN
ctgB	example	gene	2000	8000	.	-	.	ID=GENE2;Name=GENE2
`

    const buffer = new TextEncoder().encode(gffContent)
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe(
      '##gff-version 3\n# This is a comment\n##sequence-region ctgA 1 50001',
    )
    expect(result.featureMap.ctgA).toBe(
      'ctgA	example	contig	1	50001	.	.	.	Name=ctgA\nctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN\n',
    )
    expect(result.featureMap.ctgB).toBe(
      'ctgB	example	gene	2000	8000	.	-	.	ID=GENE2;Name=GENE2\n',
    )
  })

  it('should handle empty content', () => {
    const buffer = new TextEncoder().encode('')
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe('')
    expect(result.featureMap).toEqual({})
  })

  it('should handle content with only headers', () => {
    const gffContent = `##gff-version 3
# This is a comment
##sequence-region ctgA 1 50001
`

    const buffer = new TextEncoder().encode(gffContent)
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe(
      '##gff-version 3\n# This is a comment\n##sequence-region ctgA 1 50001',
    )
    expect(result.featureMap).toEqual({})
  })

  it('should handle content with only features (no headers)', () => {
    const gffContent = `ctgA	example	contig	1	50001	.	.	.	Name=ctgA
ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN
ctgB	example	gene	2000	8000	.	-	.	ID=GENE2;Name=GENE2
`

    const buffer = new TextEncoder().encode(gffContent)
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe('')
    expect(result.featureMap.ctgA).toBe(
      'ctgA	example	contig	1	50001	.	.	.	Name=ctgA\nctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN\n',
    )
    expect(result.featureMap.ctgB).toBe(
      'ctgB	example	gene	2000	8000	.	-	.	ID=GENE2;Name=GENE2\n',
    )
  })

  it('should handle file with trailing newline', () => {
    const gffContent = `##gff-version 3
ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN
`

    const buffer = new TextEncoder().encode(gffContent)
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe('##gff-version 3')
    expect(result.featureMap.ctgA).toBe(
      'ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN\n',
    )
  })

  it('should handle file without trailing newline', () => {
    const gffContent = `##gff-version 3
ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN`

    const buffer = new TextEncoder().encode(gffContent)
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe('##gff-version 3')
    expect(result.featureMap.ctgA).toBe(
      'ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN\n',
    )
  })

  it('should handle empty lines', () => {
    const gffContent = `##gff-version 3


ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN

ctgB	example	gene	2000	8000	.	-	.	ID=GENE2;Name=GENE2

`

    const buffer = new TextEncoder().encode(gffContent)
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe('##gff-version 3')
    expect(result.featureMap.ctgA).toBe(
      'ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN\n',
    )
    expect(result.featureMap.ctgB).toBe(
      'ctgB	example	gene	2000	8000	.	-	.	ID=GENE2;Name=GENE2\n',
    )
  })

  it('should stop parsing at FASTA sequence section', () => {
    const gffContent = `##gff-version 3
ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN
>ctgA
ATCGATCGATCG
ctgB	example	gene	2000	8000	.	-	.	ID=GENE2;Name=GENE2
`

    const buffer = new TextEncoder().encode(gffContent)
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe('##gff-version 3')
    expect(result.featureMap.ctgA).toBe(
      'ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN\n',
    )
    expect(result.featureMap.ctgB).toBeUndefined()
  })

  it('should handle multiple features for same reference', () => {
    const gffContent = `##gff-version 3
ctgA	example	gene	1000	2000	.	+	.	ID=GENE1;Name=GENE1
ctgA	example	gene	3000	4000	.	+	.	ID=GENE2;Name=GENE2
ctgA	example	gene	5000	6000	.	+	.	ID=GENE3;Name=GENE3
`

    const buffer = new TextEncoder().encode(gffContent)
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe('##gff-version 3')
    expect(result.featureMap.ctgA).toBe(
      'ctgA	example	gene	1000	2000	.	+	.	ID=GENE1;Name=GENE1\nctgA	example	gene	3000	4000	.	+	.	ID=GENE2;Name=GENE2\nctgA	example	gene	5000	6000	.	+	.	ID=GENE3;Name=GENE3\n',
    )
  })

  it('should call status callback during parsing', () => {
    const gffContent = `##gff-version 3
ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN
`

    const buffer = new TextEncoder().encode(gffContent)
    const mockStatusCallback = vi.fn()

    parseGffBuffer(buffer, mockStatusCallback)

    expect(mockStatusCallback).toHaveBeenCalledWith(
      expect.stringContaining('Loading'),
    )
  })

  it('should handle single line file without newline', () => {
    const gffContent = `ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN`

    const buffer = new TextEncoder().encode(gffContent)
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe('')
    expect(result.featureMap.ctgA).toBe(
      'ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN\n',
    )
  })

  it('should handle whitespace-only lines', () => {
    const gffContent = `##gff-version 3


ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN
`

    const buffer = new TextEncoder().encode(gffContent)
    const result = parseGffBuffer(buffer)

    expect(result.header).toBe('##gff-version 3')
    expect(result.featureMap.ctgA).toBe(
      'ctgA	example	gene	1000	9000	.	+	.	ID=EDEN;Name=EDEN\n',
    )
  })
})
