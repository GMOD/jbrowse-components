import { sameCircularRegions } from './sameCircularRegions.ts'

function region(
  refName: string,
  end: number,
  assemblyName = 'GRCh38',
): { refName: string; start: number; end: number; assemblyName: string } {
  return { refName, start: 0, end, assemblyName }
}

test('an unchanged list is the same list', () => {
  const regions = [region('chr1', 248956422), region('chr2', 242193529)]
  expect(sameCircularRegions(regions, [...regions])).toBe(true)
})

test('a different length is a different list', () => {
  expect(
    sameCircularRegions(
      [region('chr1', 1000)],
      [region('chr1', 1000), region('chr2', 2000)],
    ),
  ).toBe(false)
})

test('a reordered list is a different list', () => {
  expect(
    sameCircularRegions(
      [region('chr1', 1000), region('chr2', 2000)],
      [region('chr2', 2000), region('chr1', 1000)],
    ),
  ).toBe(false)
})

// Regression: the check used to compare refNames only, so switching the sheet
// between two assemblies that share a refName list left the circle drawn on the
// old one's coordinates
test('the same refNames at different lengths is a different list', () => {
  expect(
    sameCircularRegions(
      [
        region('chr1', 248956422, 'GRCh38'),
        region('chr2', 242193529, 'GRCh38'),
      ],
      [
        region('chr1', 248387328, 'T2T-CHM13'),
        region('chr2', 242696752, 'T2T-CHM13'),
      ],
    ),
  ).toBe(false)
})

test('the same coordinates under a different assembly is a different list', () => {
  expect(
    sameCircularRegions(
      [region('chr1', 1000, 'hg38')],
      [region('chr1', 1000, 'hg38-copy')],
    ),
  ).toBe(false)
})

test('two empty lists are the same list', () => {
  expect(sameCircularRegions([], [])).toBe(true)
})
