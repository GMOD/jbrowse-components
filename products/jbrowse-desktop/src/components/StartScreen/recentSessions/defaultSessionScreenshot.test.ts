import { defaultSessionScreenshot } from './defaultSessionScreenshot.ts'

test('the placeholder thumbnail is an SVG that parses', () => {
  const prefix = 'data:image/svg+xml,'
  expect(defaultSessionScreenshot.startsWith(prefix)).toBe(true)
  const doc = new DOMParser().parseFromString(
    decodeURIComponent(defaultSessionScreenshot.slice(prefix.length)),
    'image/svg+xml',
  )
  expect(doc.querySelector('parsererror')).toBeNull()
  expect(doc.documentElement.nodeName).toBe('svg')
  expect(doc.querySelectorAll('path')).toHaveLength(5)
})
