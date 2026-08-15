import {
  attributeTooltipLines,
  featureAttributes,
} from './attributeTooltipLines.ts'

const attributes = {
  identity: new Float32Array([0.9876, -1]),
  meanIdentity: new Float32Array([-1, 0.5]),
  mappingQual: new Float32Array([60, 60]),
  ka_ks: new Float32Array([1.5, -1]),
}

test('reads one feature, dropping the -1 missing sentinel', () => {
  expect(featureAttributes(attributes, 0)).toEqual({
    identity: 0.9876000285148621,
    mappingQual: 60,
    ka_ks: 1.5,
  })
  expect(featureAttributes(attributes, 1)).toEqual({
    meanIdentity: 0.5,
    mappingQual: 60,
  })
})

test('an index past the end carries nothing', () => {
  expect(featureAttributes(attributes, 9)).toEqual({})
})

// The labels the legend uses for the modes that paint these channels, so the
// two can't name the same number differently. A declared column keeps the name
// its author gave it.
test('labels the presets and leaves a declared column alone', () => {
  expect(attributeTooltipLines(featureAttributes(attributes, 0))).toEqual([
    'Identity: 0.988',
    'Mapping quality: 60',
    'ka_ks: 1.5',
  ])
  expect(attributeTooltipLines(featureAttributes(attributes, 1))).toEqual([
    'Mean query identity: 0.5',
    'Mapping quality: 60',
  ])
})

// A ratio needs its significant digits; an integer count reads better whole and
// grouped, which is what a mapping quality or a declared count is.
test('formats a ratio by precision and an integer unabbreviated', () => {
  expect(attributeTooltipLines({ dnds: 0.123456 })).toEqual(['dN/dS: 0.123'])
  expect(attributeTooltipLines({ mappingQual: 12345 })).toEqual([
    'Mapping quality: 12,345',
  ])
})
