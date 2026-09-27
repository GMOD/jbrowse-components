import { trackFields } from './fields.ts'

function scalePaths(value: unknown, displayType: string) {
  const steps = trackFields.scales!(value, { noun: 'read', displayType })
  return (Array.isArray(steps) ? steps : [steps]).map(step => step?.path)
}

test('a row height is the shared Row height menu, with each display its presets', () => {
  const path = (value: number, displayType: string) => {
    const step = trackFields.rowHeight!(value, { noun: 'row', displayType })
    return Array.isArray(step) ? undefined : step?.path
  }
  expect(path(8, 'LinearMafDisplay')).toBe('Track menu → Row height → Compact')
  expect(path(14, 'LinearMultiRowFeatureDisplay')).toBe(
    'Track menu → Row height → Normal',
  )
  expect(path(2, 'LinearMultiSampleVariantDisplay')).toBe(
    'Track menu → Row height → Custom... → 2px',
  )
  expect(path(0, 'LinearMultiSampleVariantDisplay')).toBe(
    'Track menu → Row height → Squeeze to fit view',
  )
})

test('an autoscale group is the score menu of the display it is on', () => {
  expect(
    scalePaths({ y: { autoscaleGroup: 'depth' } }, 'LinearAlignmentsDisplay'),
  ).toEqual(['Track menu → Coverage → Autoscale with other tracks...'])
  expect(
    scalePaths({ y: { autoscaleGroup: 'depth' } }, 'LinearWiggleDisplay'),
  ).toEqual(['Track menu → Score → Autoscale with other tracks...'])
})
