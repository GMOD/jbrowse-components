import { trackFields } from './fields.ts'

function scalePaths(value: unknown, displayType: string) {
  const steps = trackFields.scales!(value, { noun: 'read', displayType })
  return (Array.isArray(steps) ? steps : [steps]).map(step => step?.path)
}

test('an autoscale group is the score menu of the display it is on', () => {
  expect(
    scalePaths({ y: { autoscaleGroup: 'depth' } }, 'LinearAlignmentsDisplay'),
  ).toEqual(['Track menu → Coverage → Autoscale with other tracks...'])
  expect(
    scalePaths({ y: { autoscaleGroup: 'depth' } }, 'LinearWiggleDisplay'),
  ).toEqual(['Track menu → Score → Autoscale with other tracks...'])
})
