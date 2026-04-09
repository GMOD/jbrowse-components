import {
  createFeatureFloatingLabels,
  createTranscriptFloatingLabel,
} from './floatingLabels.ts'

import type { RenderConfigContext } from './renderConfig.ts'

const mockFeature = {
  get: () => 'test',
  id: () => 'test-id',
} as any

function createMockConfigContext(
  overrides: Partial<RenderConfigContext> = {},
): RenderConfigContext {
  const config = {
    labels: { fontSize: 12, nameColor: 'black', descriptionColor: 'blue' },
    ...overrides.config,
  }
  return {
    config,
    displayMode: 'normal',
    subfeatureLabels: 'below',
    transcriptTypes: [],
    containerTypes: [],
    geneGlyphMode: 'all',
    displayDirectionalChevrons: true,
    labelAllowed: true,
    heightMultiplier: 1,
    ...overrides,
  }
}

describe('floatingLabels', () => {
  describe('createFeatureFloatingLabels', () => {
    it('creates both name and description labels when text is present', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        configContext: createMockConfigContext(),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: 'Gene1',
        description: 'A gene',
      })
      expect(result.nameLabel).toBeDefined()
      expect(result.nameLabel!.text).toBe('Gene1')
      expect(result.descriptionLabel).toBeDefined()
      expect(result.descriptionLabel!.text).toBe('A gene')
    })

    it('returns no labels when name and description are whitespace-only', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        configContext: createMockConfigContext(),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: '   ',
        description: '   ',
      })
      expect(result.nameLabel).toBeUndefined()
      expect(result.descriptionLabel).toBeUndefined()
    })

    it('positions description below name using fontSize from config', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        configContext: createMockConfigContext(),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: 'Gene1',
        description: 'A gene',
      })
      expect(result.nameLabel!.relativeY).toBe(0)
      expect(result.descriptionLabel!.relativeY).toBe(12)
    })

    it('includes textWidth for each label', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        configContext: createMockConfigContext(),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: 'Gene1',
        description: 'A gene',
      })
      expect(result.nameLabel!.textWidth).toBeGreaterThan(0)
      expect(result.descriptionLabel!.textWidth).toBeGreaterThan(0)
    })

    it('returns only name label when description is empty', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        configContext: createMockConfigContext(),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: 'Gene1',
        description: '',
      })
      expect(result.nameLabel).toBeDefined()
      expect(result.descriptionLabel).toBeUndefined()
    })

    it('returns only description label when name is empty', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        configContext: createMockConfigContext(),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: '',
        description: 'A gene',
      })
      expect(result.nameLabel).toBeUndefined()
      expect(result.descriptionLabel).toBeDefined()
      expect(result.descriptionLabel!.relativeY).toBe(0)
    })
  })

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

    it('returns undefined when displayLabel is empty', () => {
      expect(
        createTranscriptFloatingLabel({ ...baseArgs, displayLabel: '' }),
      ).toBeUndefined()
    })

    it('includes parentFeatureId in the result', () => {
      const result = createTranscriptFloatingLabel(baseArgs)
      expect(result!.parentFeatureId).toBe('parent-gene-123')
    })

    it('sets isOverlay to false for "below" mode', () => {
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        subfeatureLabels: 'below',
      })
      expect(result!.subfeatureLabel.isOverlay).toBe(false)
      expect(result!.subfeatureLabel.relativeY).toBe(0)
    })

    it('sets isOverlay to true for "overlay" mode', () => {
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        subfeatureLabels: 'overlay',
        featureHeight: 20,
      })
      expect(result!.subfeatureLabel.isOverlay).toBe(true)
      expect(result!.subfeatureLabel.relativeY).toBe(-20)
    })

    it('truncates long labels', () => {
      const longLabel = 'A'.repeat(100)
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        displayLabel: longLabel,
      })
      expect(result!.subfeatureLabel.text.length).toBeLessThan(longLabel.length)
      expect(result!.subfeatureLabel.text).toContain('…')
    })
  })
})
