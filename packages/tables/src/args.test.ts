import { createTablesEngine } from './index.ts'
import { INV_INDELS, INV_INDELS_DOTPLOT, STAR } from './synteny.fixture.ts'
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

test("a key the view's settings do not declare is refused, naming the keys they take", async () => {
  await expect(
    // @ts-expect-error the key the view refuses
    engine.synteny({ ...INV_INDELS, view: { color: 'strand' } }),
  ).rejects.toThrow(
    'view takes no color; its keys are encoding, filter, indels, mark, axis, render, height',
  )
  await expect(
    // @ts-expect-error the key the view refuses
    engine.dotplot({ ...INV_INDELS_DOTPLOT, view: { mark: {} } }),
  ).rejects.toThrow(
    'view takes no mark; its keys are encoding, filter, indels, lineWidth',
  )
  await expect(
    engine.synteny({
      ...INV_INDELS,
      // @ts-expect-error the key the encoding refuses
      view: { encoding: { colour: 'strand' } },
    }),
  ).rejects.toThrow(/^SyntenyEncoding takes .*color.*, not colour/)
  await expect(
    engine.dotplot({
      ...INV_INDELS_DOTPLOT,
      // @ts-expect-error the key the predicate refuses
      view: { filter: [{ field: 'length', gte: 400, lessThan: 2000 }] },
    }),
  ).rejects.toThrow(/^FieldPredicate takes .*lt.*, not lessThan/)
  await expect(
    engine.synteny({
      ...INV_INDELS,
      // @ts-expect-error the key the mark refuses
      view: { mark: { curve: 'bump' } },
    }),
  ).rejects.toThrow(/^SyntenyMark takes interpolate, not curve/)
})

test("a key the multi-way display's config does not declare is refused", async () => {
  await expect(
    // @ts-expect-error the key the display refuses
    engine.multiway({ ...STAR, display: { colour: 'strand' } }),
  ).rejects.toThrow(/^MultiWaySyntenyDisplay takes .*, not colour/)
  await expect(
    engine.multiway({
      ...STAR,
      // @ts-expect-error the key the ribbons' encoding refuses
      display: { ribbons: { encoding: { colour: 'strand' } } },
    }),
  ).rejects.toThrow(/^MultiWayRibbonsEncoding takes .*, not colour/)
})

test('region and regions read the same', async () => {
  const { region, ...rest } = BAM
  const one = await engine.alignments(BAM)
  const listed = await engine.alignments({ ...rest, regions: [region] })
  expect(listed.reads.id).toEqual(one.reads.id)
  expect(listed.readAs).toEqual(one.readAs)
})
