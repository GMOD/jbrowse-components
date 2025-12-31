import { createTranscriptFloatingLabel } from './floatingLabels'

describe('floatingLabels', () => {
  describe('createTranscriptFloatingLabel', () => {
    const baseArgs = {
      displayLabel: 'Test Transcript',
      featureHeight: 10,
      subfeatureLabels: 'below',
      color: '#000000',
      parentFeatureId: 'parent-gene-123',
      subfeatureId: 'subfeature-456',
      tooltip: 'Gene: BRCA1',
    }

    it('returns null when displayLabel is empty', () => {
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        displayLabel: '',
      })
      expect(result).toBeNull()
    })

    it('includes parentFeatureId in the result for mouseover highlight', () => {
      const result = createTranscriptFloatingLabel(baseArgs)
      expect(result).not.toBeNull()
      expect(result!.parentFeatureId).toBe('parent-gene-123')
    })

    it('sets isOverlay to false for "below" mode', () => {
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        subfeatureLabels: 'below',
      })
      expect(result!.isOverlay).toBe(false)
      expect(result!.relativeY).toBe(0)
    })

    it('sets isOverlay to true for "overlay" mode', () => {
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        subfeatureLabels: 'overlay',
        featureHeight: 20,
      })
      expect(result!.isOverlay).toBe(true)
      expect(result!.relativeY).toBe(2 - 20)
    })

    it('truncates long labels', () => {
      const longLabel = 'A'.repeat(100)
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        displayLabel: longLabel,
      })
      expect(result!.text.length).toBeLessThan(longLabel.length)
      expect(result!.text).toContain('…')
    })

    it('includes all required fields', () => {
      const result = createTranscriptFloatingLabel(baseArgs)

      expect(result).toMatchObject({
        text: expect.any(String),
        relativeY: expect.any(Number),
        color: '#000000',
        textWidth: expect.any(Number),
        isOverlay: false,
        parentFeatureId: 'parent-gene-123',
        tooltip: 'Gene: BRCA1',
      })
    })

    it('preserves parentFeatureId for correct highlight rectangle', () => {
      const result = createTranscriptFloatingLabel({
        displayLabel: 'mRNA-1',
        featureHeight: 15,
        subfeatureLabels: 'overlay',
        color: '#333',
        parentFeatureId: 'gene-BRCA1',
        subfeatureId: 'mRNA-1-id',
        tooltip: 'BRCA1 tooltip',
      })

      expect(result!.parentFeatureId).toBe('gene-BRCA1')
    })

    it('includes parent tooltip for unified mouseover behavior', () => {
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        tooltip: 'Custom parent tooltip',
      })

      expect(result!.tooltip).toBe('Custom parent tooltip')
    })
  })
})
