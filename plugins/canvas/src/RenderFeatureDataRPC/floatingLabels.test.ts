import { measureText } from '@jbrowse/core/util'

import { LABEL_FONT_SIZE, MAX_DESCRIPTION_LABEL_WIDTH_PX } from './constants.ts'
import {
  createFeatureFloatingLabels,
  createTranscriptFloatingLabel,
} from './floatingLabels.ts'

describe('floatingLabels', () => {
  describe('createFeatureFloatingLabels', () => {
    it('creates both name and description labels when text is present', () => {
      const result = createFeatureFloatingLabels({
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
        name: ' '.repeat(3),
        description: ' '.repeat(3),
      })
      expect(result.nameLabel).toBeUndefined()
      expect(result.descriptionLabel).toBeUndefined()
    })

    it('leaves label positioning to the main-thread render layer', () => {
      const result = createFeatureFloatingLabels({
        name: 'Gene1',
        description: 'A gene',
      })
      // The name→description gap comes from the display mode's font size at
      // render time, so the worker bakes no vertical offset.
      expect(result.nameLabel!.relativeY).toBe(0)
      expect(result.descriptionLabel!.relativeY).toBe(0)
    })

    it('includes textWidth for each label', () => {
      const result = createFeatureFloatingLabels({
        name: 'Gene1',
        description: 'A gene',
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
      })
      const label = result.descriptionLabel!
      expect(label.text).toContain('…')
      expect(label.text.length).toBeLessThan(longDescription.length)
      // The stored textWidth is bounded by the budget, so layout reservations
      // match what is rendered.
      expect(label.textWidth).toBe(measureText(label.text, LABEL_FONT_SIZE))
      expect(label.textWidth).toBeLessThanOrEqual(
        MAX_DESCRIPTION_LABEL_WIDTH_PX,
      )
    })

    it('returns only name label when description is empty', () => {
      const result = createFeatureFloatingLabels({
        name: 'Gene1',
        description: '',
      })
      expect(result.nameLabel).toBeDefined()
      expect(result.descriptionLabel).toBeUndefined()
    })

    it('returns only description label when name is empty', () => {
      const result = createFeatureFloatingLabels({
        name: '',
        description: 'A gene',
      })
      expect(result.nameLabel).toBeUndefined()
      expect(result.descriptionLabel).toBeDefined()
      expect(result.descriptionLabel!.relativeY).toBe(0)
    })
  })

  describe('createTranscriptFloatingLabel', () => {
    it('marks an overlay label, which the main thread places on its body', () => {
      const below = createTranscriptFloatingLabel('Test Transcript', 'below')
      const overlay = createTranscriptFloatingLabel(
        'Test Transcript',
        'overlay',
      )
      expect(below).toMatchObject({ isOverlay: false, relativeY: 0 })
      expect(overlay).toMatchObject({ isOverlay: true, relativeY: 0 })
    })

    it('truncates long labels', () => {
      const longLabel = 'A'.repeat(100)
      const label = createTranscriptFloatingLabel(longLabel, 'below')
      expect(label.text.length).toBeLessThan(longLabel.length)
      expect(label.text).toContain('…')
    })
  })
})
