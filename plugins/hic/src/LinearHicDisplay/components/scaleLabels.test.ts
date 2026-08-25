import { getHicScaleLabels } from './scaleLabels.ts'
import { mapHicCount } from './shaders/hic.js.generated.ts'

// The legend bar draws ramp entry `t` at bar fraction `t` (getLegendStops), and
// its two labels are the only thing telling a reader which count sits where. So
// the label endpoints have to be the counts `mapHicCount` actually puts at the
// ends of the ramp — otherwise every interior position on the bar is read off
// against the wrong score.

function labelScore(label: string) {
  return Number(label.replace(' (log)', '').replaceAll(',', ''))
}

function legendFraction(count: number, labels: [number, number], log: boolean) {
  const [min, max] = labels
  return log
    ? Math.log2(Math.max(count, min)) / Math.log2(max)
    : (count - min) / (max - min)
}

test.each([
  ['log', 3000, true, [1, 8, 64, 512, 3000]],
  ['linear', 37, false, [0, 5, 18.5, 30, 37]],
] as const)(
  '%s legend labels put every count where the ramp paints it',
  (_name, colorMaxScore, useLogScale, counts) => {
    const { minLabel, maxLabel } = getHicScaleLabels(colorMaxScore, useLogScale)
    const labels: [number, number] = [
      labelScore(minLabel),
      labelScore(maxLabel),
    ]
    for (const count of counts) {
      expect(legendFraction(count, labels, useLogScale)).toBeCloseTo(
        mapHicCount(count, colorMaxScore, useLogScale),
        6,
      )
    }
  },
)

test('the max label names the count the ramp saturates at', () => {
  expect(getHicScaleLabels(3000, true).maxLabel).toBe('3,000 (log)')
  expect(getHicScaleLabels(37, false).maxLabel).toBe('37')
})

test('the shader floors are what a degenerate block labels', () => {
  expect(getHicScaleLabels(1, true).maxLabel).toBe('2 (log)')
  expect(getHicScaleLabels(0.0005, false).maxLabel).toBe('0.001')
})
