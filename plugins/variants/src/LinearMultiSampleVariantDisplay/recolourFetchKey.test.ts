import { createTestEnvironment } from './testEnv.ts'

function display() {
  return createTestEnvironment().createDisplay().display
}

test('a recolour of one field keeps the fetch key', () => {
  const d = display()
  d.setColor({ field: 'INFO.AF', scale: 'categorical' })
  const key = d.rpcProps()
  d.setColor({ field: 'INFO.AF', scale: 'categorical', range: ['#aa0000'] })
  expect(d.rpcProps()).toEqual(key)
  d.setColor({ field: 'INFO.AF', scale: 'threshold', domain: ['0.01'] })
  expect(d.rpcProps()).toEqual(key)
  d.setShadeByDosage(false)
  expect(d.rpcProps()).toEqual(key)
  d.setColor({ field: 'INFO.DP', scale: 'threshold', domain: ['10'] })
  expect(d.rpcProps()).not.toEqual(key)
})

test('a constant reads nothing, and a jexl callback is read in the worker', () => {
  const d = display()
  const key = d.rpcProps()
  d.setColor({ value: '#123456' })
  expect(d.rpcProps()).toEqual(key)
  d.setColor({ value: "jexl:'#123456'" })
  expect(d.rpcProps().color).toBe("jexl:'#123456'")
})
