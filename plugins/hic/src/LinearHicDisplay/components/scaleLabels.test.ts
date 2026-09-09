import { hicScaleDomain } from './scaleLabels.ts'
import { mapHicCount } from './shaders/hic.js.generated.ts'

// The legend bar draws ramp entry `t` at bar fraction `t`, and its two domain
// labels are the only thing telling a reader which count sits where. So the
// domain ends have to be the counts `mapHicCount` actually puts at the ends of
// the ramp — otherwise every interior position on the bar is read off against
// the wrong score.

function legendFraction(count: number, domain: [number, number], log: boolean) {
  const [min, max] = domain
  return log
    ? Math.log2(Math.max(count, min)) / Math.log2(max)
    : (count - min) / (max - min)
}

test.each([
  ['log', 3000, true, [1, 8, 64, 512, 3000]],
  ['linear', 37, false, [0, 5, 18.5, 30, 37]],
] as const)(
  '%s scale domain puts every count where the ramp paints it',
  (_name, colorMaxScore, useLogScale, counts) => {
    const domain = hicScaleDomain(colorMaxScore, useLogScale)
    for (const count of counts) {
      expect(legendFraction(count, domain, useLogScale)).toBeCloseTo(
        mapHicCount(count, colorMaxScore, useLogScale),
        6,
      )
    }
  },
)

test('the domain top is the count the ramp saturates at', () => {
  expect(hicScaleDomain(3000, true)).toEqual([1, 3000])
  expect(hicScaleDomain(37, false)).toEqual([0, 37])
})

test('the shader floors are what a degenerate block spans', () => {
  expect(hicScaleDomain(1, true)).toEqual([1, 2])
  expect(hicScaleDomain(0.0005, false)).toEqual([0, 0.001])
})
