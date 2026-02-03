import {
  createFeatureFloatingLabels,
  createTranscriptFloatingLabel,
} from './floatingLabels.ts'

import type { RenderConfigContext } from './renderConfig.ts'

// Mock feature for testing
const mockFeature = {
  get: () => 'test',
  id: () => 'test-id',
} as any

// Mock config that returns the cached value directly
const mockConfig = {} as any

// Helper to create a mock config context
function createMockConfigContext(
  overrides: Partial<RenderConfigContext> = {},
): RenderConfigContext {
  return {
    config: mockConfig,
    displayMode: 'normal',
    showLabels: true,
    showDescriptions: true,
    subfeatureLabels: 'below',
    transcriptTypes: [],
    containerTypes: [],
    geneGlyphMode: 'gene',
    displayDirectionalChevrons: true,
    color1: { value: 'goldenrod', isCallback: false },
    color2: { value: '#f0f', isCallback: false },
    color3: { value: '#357089', isCallback: false },
    outline: { value: '', isCallback: false },
    featureHeight: { value: 10, isCallback: false },
    fontHeight: { value: 12, isCallback: false },
    nameColor: { value: 'black', isCallback: false },
    descriptionColor: { value: 'blue', isCallback: false },
    labelAllowed: true,
    heightMultiplier: 1,
    ...overrides,
  }
}

describe('floatingLabels', () => {
  describe('createFeatureFloatingLabels', () => {
    it('returns empty array when both showLabels and showDescriptions are false', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        config: mockConfig,
        configContext: createMockConfigContext({
          showLabels: false,
          showDescriptions: false,
        }),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: 'Gene1',
        description: 'A gene',
      })
      expect(result).toEqual([])
    })

    it('returns empty array when name and description are whitespace-only', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        config: mockConfig,
        configContext: createMockConfigContext(),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: '   ',
        description: '   ',
      })
      expect(result).toEqual([])
    })

    it('returns only name label when showDescriptions is false', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        config: mockConfig,
        configContext: createMockConfigContext({ showDescriptions: false }),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: 'Gene1',
        description: 'A gene',
      })
      expect(result).toHaveLength(1)
      expect(result[0]!.text).toBe('Gene1')
      expect(result[0]!.color).toBe('black')
      expect(result[0]!.relativeY).toBe(0)
    })

    it('returns only description label when showLabels is false', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        config: mockConfig,
        configContext: createMockConfigContext({ showLabels: false }),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: 'Gene1',
        description: 'A gene',
      })
      expect(result).toHaveLength(1)
      expect(result[0]!.text).toBe('A gene')
      expect(result[0]!.color).toBe('blue')
      expect(result[0]!.relativeY).toBe(0)
    })

    it('returns both labels with correct positioning when both enabled', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        config: mockConfig,
        configContext: createMockConfigContext(),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: 'Gene1',
        description: 'A gene',
      })
      expect(result).toHaveLength(2)
      expect(result[0]!.text).toBe('Gene1')
      expect(result[0]!.relativeY).toBe(0)
      expect(result[1]!.text).toBe('A gene')
      expect(result[1]!.relativeY).toBe(12) // fontHeight value from mock
    })

    it('includes textWidth for each label', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        config: mockConfig,
        configContext: createMockConfigContext(),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: 'Gene1',
        description: 'A gene',
      })
      expect(result[0]!.textWidth).toBeGreaterThan(0)
      expect(result[1]!.textWidth).toBeGreaterThan(0)
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
