import { buildSoftclipBaseArrays } from './buildArrays.ts'

const clip = (clipStart: number, sequence?: string, readIndex = 0) => ({
  readIndex,
  position: clipStart,
  clipStart,
  length: sequence?.length ?? 5,
  sequence,
})

const basesOf = (r: ReturnType<typeof buildSoftclipBaseArrays>) =>
  [...r.softclipBasePositions].map((position, i) => [
    position,
    String.fromCharCode(r.softclipBaseBases[i]!),
    r.softclipBaseReadIndices[i],
  ])

describe('buildSoftclipBaseArrays clamps to the fetched region', () => {
  it('keeps a left clip only from region.start on', () => {
    expect(
      basesOf(buildSoftclipBaseArrays([clip(97, 'acgtA', 3)], 100, 200)),
    ).toEqual([
      [100, 'T', 3],
      [101, 'A', 3],
    ])
  })

  it('keeps a right clip only up to region.end', () => {
    expect(
      basesOf(buildSoftclipBaseArrays([clip(198, 'GATTC')], 100, 200)),
    ).toEqual([
      [198, 'G', 0],
      [199, 'A', 0],
    ])
  })

  it('drops the bases a clip places before the reference start', () => {
    expect(
      basesOf(buildSoftclipBaseArrays([clip(-3, 'CCGTA')], 0, 50)),
    ).toEqual([
      [0, 'T', 0],
      [1, 'A', 0],
    ])
  })

  it('ships nothing for a read with no SEQ beside one with bases', () => {
    expect(
      basesOf(
        buildSoftclipBaseArrays([clip(120), clip(130, 'AC', 1)], 100, 200),
      ),
    ).toEqual([
      [130, 'A', 1],
      [131, 'C', 1],
    ])
  })

  it('ships nothing for a clip entirely outside the region', () => {
    expect(
      buildSoftclipBaseArrays([clip(90, 'ACGTA'), clip(200, 'ACG')], 100, 200)
        .softclipBasePositions.length,
    ).toBe(0)
  })
})
