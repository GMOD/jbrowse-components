import { createJBrowseTheme } from '@jbrowse/core/ui'
import { measureText } from '@jbrowse/core/util'

import { LABEL_FONT_SIZE, MAX_DESCRIPTION_LABEL_WIDTH_PX } from './constants.ts'
import {
  createFeatureFloatingLabels,
  createTranscriptFloatingLabel,
} from './floatingLabels.ts'

const theme = createJBrowseTheme()

describe('floatingLabels', () => {
  describe('createFeatureFloatingLabels', () => {
    it('creates both name and description labels when text is present', () => {
      const result = createFeatureFloatingLabels({
        name: 'Gene1',
        description: 'A gene',
        theme,
      })
      expect(result.nameLabel).toBeDefined()
      expect(result.nameLabel!.text).toBe('Gene1')
      expect(result.descriptionLabel).toBeDefined()
      expect(result.descriptionLabel!.text).toBe('A gene')
    })

    it('colors labels from the theme so the SVG export matches the app', () => {
      const result = createFeatureFloatingLabels({
        name: 'Gene1',
        description: 'A gene',
        theme,
      })
      expect(result.nameLabel!.color).toBe(theme.palette.text.primary)
      expect(result.descriptionLabel!.color).toBe(
        theme.palette.featureDescription,
      )
    })

    it('returns no labels when name and description are whitespace-only', () => {
      const result = createFeatureFloatingLabels({
        name: ' '.repeat(3),
        description: ' '.repeat(3),
        theme,
      })
      expect(result.nameLabel).toBeUndefined()
      expect(result.descriptionLabel).toBeUndefined()
    })

    it('leaves label positioning to the main-thread render layer', () => {
      const result = createFeatureFloatingLabels({
        name: 'Gene1',
        description: 'A gene',
        theme,
      })
      // The name→description gap is applied at render time from the display
      // mode's font size (labelPositioning.resolveFeatureLabels), so the worker
      // bakes no vertical offset.
      expect(result.nameLabel!.relativeY).toBe(0)
      expect(result.descriptionLabel!.relativeY).toBe(0)
    })

    it('includes textWidth for each label', () => {
      const result = createFeatureFloatingLabels({
        name: 'Gene1',
        description: 'A gene',
        theme,
      })
      expect(result.nameLabel!.textWidth).toBeGreaterThan(0)
      expect(result.descriptionLabel!.textWidth).toBeGreaterThan(0)
    })

    it('truncates a long description so its textWidth stays within budget', () => {
      const longDescription =
        'The protein encoded by this gene catalyzes the reduction of a long sentence'
      const result = createFeatureFloatingLabels({
        name: 'Gene1',
        description: longDescription,
        theme,
      })
      const label = result.descriptionLabel!
      expect(label.text).toContain('…')
      expect(label.text.length).toBeLessThan(longDescription.length)
      // The stored textWidth equals the drawn text width and is bounded by
      // the budget, so layout reservations match what is rendered.
      expect(label.textWidth).toBe(measureText(label.text, LABEL_FONT_SIZE))
      expect(label.textWidth).toBeLessThanOrEqual(
        MAX_DESCRIPTION_LABEL_WIDTH_PX,
      )
    })

    it('returns only name label when description is empty', () => {
      const result = createFeatureFloatingLabels({
        name: 'Gene1',
        description: '',
        theme,
      })
      expect(result.nameLabel).toBeDefined()
      expect(result.descriptionLabel).toBeUndefined()
    })

    it('returns only description label when name is empty', () => {
      const result = createFeatureFloatingLabels({
        name: '',
        description: 'A gene',
        theme,
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
      parentFeatureId: 'parent-gene-123',
      theme,
    }

    it('includes parentFeatureId in the result', () => {
      const result = createTranscriptFloatingLabel(baseArgs)
      expect(result.parentFeatureId).toBe('parent-gene-123')
    })

    it('sets isOverlay to false for "below" mode', () => {
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        subfeatureLabels: 'below',
      })
      expect(result.subfeatureLabel.isOverlay).toBe(false)
      expect(result.subfeatureLabel.relativeY).toBe(0)
      expect(result.subfeatureLabel.color).toBe(theme.palette.text.primary)
    })

    it('sets isOverlay to true for "overlay" mode', () => {
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        subfeatureLabels: 'overlay',
        featureHeight: 20,
      })
      expect(result.subfeatureLabel.isOverlay).toBe(true)
      expect(result.subfeatureLabel.relativeY).toBe(-20)
      expect(result.subfeatureLabel.color).toBe(theme.palette.common.black)
    })

    it('truncates long labels', () => {
      const longLabel = 'A'.repeat(100)
      const result = createTranscriptFloatingLabel({
        ...baseArgs,
        displayLabel: longLabel,
      })
      expect(result.subfeatureLabel.text.length).toBeLessThan(longLabel.length)
      expect(result.subfeatureLabel.text).toContain('…')
    })
  })
})
