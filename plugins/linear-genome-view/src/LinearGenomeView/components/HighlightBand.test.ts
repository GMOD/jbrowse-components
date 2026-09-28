import { gapMask } from './HighlightBand.tsx'

test('a gap makes the band transparent between its two edges only', () => {
  expect(gapMask([{ top: 100, height: 50 }])).toBe(
    'linear-gradient(to bottom, #000 100px, transparent 100px, transparent 150px, #000 150px)',
  )
})

test('each gap adds its own transparent stretch', () => {
  const css = gapMask([
    { top: 10, height: 5 },
    { top: 40, height: 20 },
  ])
  expect(css).toContain('transparent 10px, transparent 15px')
  expect(css).toContain('transparent 40px, transparent 60px')
})
