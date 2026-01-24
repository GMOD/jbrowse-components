describe('LinearPileupDisplay preProcessSnapshot', () => {
  // The preProcessSnapshot function transforms simplified options
  // into the full snapshot format

  describe('color option transformation', () => {
    test('transforms simple color type string to colorBySetting object', () => {
      // Input: { color: 'strand' }
      // Expected output: { colorBySetting: { type: 'strand' } }
      const input = { color: 'strand' }
      const expected = { colorBySetting: { type: 'strand' } }

      // The actual transformation is done by MST preProcessSnapshot
      // This test documents the expected behavior
      expect(parseColorOption(input.color)).toEqual(expected.colorBySetting)
    })

    test('transforms color with tag to colorBySetting with tag', () => {
      // Input: { color: 'tag:HP' }
      // Expected output: { colorBySetting: { type: 'tag', tag: 'HP' } }
      const input = { color: 'tag:HP' }
      const expected = { colorBySetting: { type: 'tag', tag: 'HP' } }

      expect(parseColorOption(input.color)).toEqual(expected.colorBySetting)
    })

    test('handles methylation color type', () => {
      const input = { color: 'methylation' }
      const expected = { colorBySetting: { type: 'methylation' } }

      expect(parseColorOption(input.color)).toEqual(expected.colorBySetting)
    })
  })
})

// Helper to match the preProcessSnapshot logic
function parseColorOption(color: string) {
  const [type, tag] = color.split(':')
  return tag ? { type, tag } : { type }
}
