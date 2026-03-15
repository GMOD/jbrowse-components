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
    it('returns only description when showLabels is false', () => {
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
      expect(result.nameLabel).toBeUndefined()
      expect(result.descriptionLabel).toBeDefined()
    })

    it('returns no labels when name and description are whitespace-only', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        config: mockConfig,
        configContext: createMockConfigContext(),
        nameColor: 'black',
        descriptionColor: 'blue',
        name: '   ',
        description: '   ',
      })
      expect(result.nameLabel).toBeUndefined()
      expect(result.descriptionLabel).toBeUndefined()
    })

    it('always includes description label regardless of showDescriptions config', () => {
      const result = createFeatureFloatingLabels({
        feature: mockFeature,
        config: mockConfig,
        configContext: createMockConfigContext({ showDescriptions: false }),
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
      expect(result.nameLabel).toBeUndefined()
      expect(result.descriptionLabel).toBeDefined()
      expect(result.descriptionLabel!.text).toBe('A gene')
      expect(result.descriptionLabel!.color).toBe('blue')
      expect(result.descriptionLabel!.relativeY).toBe(0)
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
      expect(result.nameLabel).toBeDefined()
      expect(result.nameLabel!.text).toBe('Gene1')
      expect(result.nameLabel!.relativeY).toBe(0)
      expect(result.descriptionLabel).toBeDefined()
      expect(result.descriptionLabel!.text).toBe('A gene')
      expect(result.descriptionLabel!.relativeY).toBe(12) // fontHeight value from mock
    })

    it('description label data is stable across zoom levels (regression: labels disappear during zoom)', () => {
      const baseArgs = {
        feature: mockFeature,
        config: mockConfig,
        nameColor: 'black',
        descriptionColor: 'blue',
        name: 'Gene1',
        description: 'A gene',
      }
      const zoomedOut = createFeatureFloatingLabels({
        ...baseArgs,
        configContext: createMockConfigContext({ showDescriptions: false }),
      })
      const zoomedIn = createFeatureFloatingLabels({
        ...baseArgs,
        configContext: createMockConfigContext({ showDescriptions: true }),
      })
      expect(zoomedOut.descriptionLabel).toBeDefined()
      expect(zoomedIn.descriptionLabel).toBeDefined()
      expect(zoomedOut.descriptionLabel!.text).toBe(
        zoomedIn.descriptionLabel!.text,
      )
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
      expect(result.nameLabel!.textWidth).toBeGreaterThan(0)
      expect(result.descriptionLabel!.textWidth).toBeGreaterThan(0)
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
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        displayLabel: '',
      })
      expect(result).toBeUndefined()
    })

    it('includes parentFeatureId in the result for mouseover highlight', () => {
      const result = createTranscriptFloatingLabel(baseArgs)
      expect(result).toBeDefined()
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

    it('includes all required fields', () => {
      const result = createTranscriptFloatingLabel(baseArgs)

      expect(result).toMatchObject({
        parentFeatureId: 'parent-gene-123',
        subfeatureLabel: {
          text: expect.any(String),
          relativeY: expect.any(Number),
          color: '#000000',
          textWidth: expect.any(Number),
          isOverlay: false,
          tooltip: 'Gene: BRCA1',
        },
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

      expect(result!.subfeatureLabel.tooltip).toBe('Custom parent tooltip')
    })
  })
})
