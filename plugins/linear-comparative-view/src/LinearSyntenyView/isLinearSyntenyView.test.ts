import { isLinearSyntenyView } from './isLinearSyntenyView.ts'

test('only the synteny view passes', () => {
  expect(isLinearSyntenyView({ type: 'LinearSyntenyView' })).toBe(true)
  expect(isLinearSyntenyView({ type: 'LinearGenomeView' })).toBe(false)
  expect(isLinearSyntenyView(undefined)).toBe(false)
})
