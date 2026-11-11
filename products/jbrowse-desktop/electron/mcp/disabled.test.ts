import { mcpDisabled } from './disabled.ts'

test.each([undefined, '', '0', 'false', 'FALSE', ' 0 '])(
  '%p leaves the endpoint on',
  value => {
    expect(mcpDisabled(value)).toBe(false)
  },
)

test.each(['1', 'true', 'yes'])('%p turns the endpoint off', value => {
  expect(mcpDisabled(value)).toBe(true)
})
