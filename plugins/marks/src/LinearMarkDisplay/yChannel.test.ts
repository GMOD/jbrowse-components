import { readConfObject } from '@jbrowse/core/configuration'

import { configSchemaFactory } from './configSchema.ts'

const schema = configSchemaFactory()
const Y = ['encoding', 'y'] as const

test('a bare string at the display-level encoding.y is refused', () => {
  expect(() =>
    schema.create({ displayId: 'd', encoding: { y: 'score' } }),
  ).toThrow('YChannel')
})

test("an early v5 scales.y lands on encoding.y under the channel's names", () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const conf = schema.create({
    displayId: 'd',
    scales: {
      y: {
        type: 'log',
        domainQuantile: 0.9,
        symlogConstant: 3,
        autoscaleGroup: 'p',
        title: '-log10 p',
        grid: true,
        minimalTicks: true,
        rules: [7.3],
      },
    },
  })
  expect(readConfObject(conf, [...Y, 'scale', 'type'])).toBe('log')
  expect(readConfObject(conf, [...Y, 'scale', 'fenceQuantile'])).toBe(0.9)
  expect(readConfObject(conf, [...Y, 'scale', 'constant'])).toBe(3)
  expect(readConfObject(conf, [...Y, 'scale', 'group'])).toBe('p')
  expect(readConfObject(conf, [...Y, 'axis', 'title'])).toBe('-log10 p')
  expect(readConfObject(conf, [...Y, 'axis', 'grid'])).toBe(true)
  expect(conf.encoding.y.rules.map(r => readConfObject(r, 'value'))).toEqual([
    7.3,
  ])
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

test('the fence starts at 1, the extremes', () => {
  const conf = schema.create({ displayId: 'd' })
  expect(readConfObject(conf, [...Y, 'scale', 'fenceQuantile'])).toBe(1)
})
