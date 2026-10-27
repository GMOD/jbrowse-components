import { createTablesEngine } from './index.ts'
import { INV_INDELS } from './synteny.fixture.ts'
import { BAM, GFF3 } from './volvox.fixture.ts'

const engine = createTablesEngine()

test('a key the call does not take is refused, naming it', async () => {
  await expect(
    // @ts-expect-error the key the call refuses
    engine.features({ ...GFF3, colorByCDS: true }),
  ).rejects.toThrow(/^features takes no colorByCDS; its args are /)
  await expect(
    // @ts-expect-error the key the call refuses
    engine.synteny({ ...INV_INDELS, curves: true }),
  ).rejects.toThrow(/^synteny takes no curves/)
})

test('region and regions read the same', async () => {
  const { region, ...rest } = BAM
  const one = await engine.alignments(BAM)
  const listed = await engine.alignments({ ...rest, regions: [region] })
  expect(listed.reads.id).toEqual(one.reads.id)
  expect(listed.readAs).toEqual(one.readAs)
})
