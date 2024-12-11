import { parseBedPEBuffer } from './BedpeImport'

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

// Test 1: Standard 6-column BED file
test('parses standard 6-column BED file', () => {
  const bedContent = `1	564465	564465	MT	3917	3917	122419_0	,	-	+	TRA
1	565470	565470	MT	4920	4920	116060_1	,	-	+	TRA
1	567235	567235	MT	6707	6707	116060_1	,	+	-	TRA
`

  expect(parseBedPEBuffer(stringToUint8Array(bedContent))).toMatchSnapshot()
})
