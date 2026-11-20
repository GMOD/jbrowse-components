import { fieldHeading } from './sectionsMenu.ts'

test('a field heads the Sections column by its name, an expression as Section', () => {
  expect(fieldHeading('gene_biotype')).toBe('Gene_biotype')
  expect(fieldHeading('jexl:get(feature,"type")')).toBe('Section')
  expect(fieldHeading(undefined)).toBe('Section')
})
