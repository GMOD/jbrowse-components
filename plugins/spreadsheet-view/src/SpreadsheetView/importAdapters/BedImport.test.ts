import { parseBedBuffer } from './BedImport.ts' // Adjust import path as needed

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

// Test 1: Standard 6-column BED file
test('parses standard 6-column BED file', () => {
  const bedContent = `chr1	100	250	feature1	0	+
chr1	300	450	feature2	50	-
chr2	1000	1500	feature3	100	+`

  expect(parseBedBuffer(stringToUint8Array(bedContent))).toMatchSnapshot()
})

// Test 2: BED file with extra columns and custom header
test('parses BED file with custom columns', () => {
  const bedContent = `#chr	start	end	name	score	strand	gene_name	expression_level
chr1	100	250	feature1	0	+	BRCA1	1.5
chr1	300	450	feature2	50	-	TP53	2.3
chr2	1000	1500	feature3	100	+	KRAS	0.7
`

  expect(parseBedBuffer(stringToUint8Array(bedContent))).toMatchSnapshot()
})

// Test 3: BED file with metadata and track lines
test('parses BED file with metadata lines', () => {
  const bedContent = `browser position chr1:100-500
track name="Sample Track" description="Test Genomic Features"
#chr	start	end	name	score	strand	gene_name	tissue_type
chr1	100	250	feature1	0	+	BRCA1	breast
chr1	300	450	feature2	50	-	TP53	liver
chr2	1000	1500	feature3	100	+	KRAS	lung`

  expect(parseBedBuffer(stringToUint8Array(bedContent))).toMatchSnapshot()
})

// Test 4: BED file with many extra columns
test('parses BED file with multiple extra columns', () => {
  const bedContent = `#chr	start	end	name	score	strand	gene_name	expression	chr_arm	mutation_type	confidence_score
chr1	100	250	feature1	0	+	BRCA1	1.5	1p	missense	0.95
chr1	300	450	feature2	50	-	TP53	2.3	17p	nonsense	0.88
chr2	1000	1500	feature3	100	+	KRAS	0.7	12q	frameshift	0.75`

  expect(parseBedBuffer(stringToUint8Array(bedContent))).toMatchSnapshot()
})
