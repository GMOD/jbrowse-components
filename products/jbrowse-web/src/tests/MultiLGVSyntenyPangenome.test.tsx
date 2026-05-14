import { waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('MultiLGVSyntenyDisplay renders with GfaTabixAdapter', async () => {
  const user = userEvent.setup()
  const { view, findByTestId } = await createView()

  await view.navToLocString('ctgA:1-50000')

  await user.click(
    await findByTestId(hts('volvox_pangenome_50_gfa_tabix'), ...opts),
  )

  await waitFor(() => {
    expect(view.initialized).toBe(true)
  }, delay)

  const canvas = await findByTestId('multi_synteny_canvas_done', ...opts)
  expectCanvasMatch(canvas)
}, 90000)

// Fast, fully-local check of the GRAPH_PLAN "v1" chr20-pangenome scheme:
// a MultiLGVSyntenyDisplay fed by a tabix `odgi untangle` PAF
// (TabixPAFAdapter) plus the separate `vg deconstruct` VCF track that
// carries the per-base SNP/indel detail the block-level synteny can't show.
// Both reference volvox ctgA, so they render row-aligned in one LGV just
// like the HPRC chr20 config.
test('MultiLGVSyntenyDisplay + per-base VCF render together (TabixPAFAdapter)', async () => {
  const user = userEvent.setup()
  const { view, findByTestId, findAllByTestId } = await createView()

  await view.navToLocString('ctgA:1-3000')

  await user.click(
    await findByTestId(hts('volvox_untangle_tabix_paf'), ...opts),
  )
  await user.click(await findByTestId(hts('volvox_pangenome_50_vcf'), ...opts))

  await waitFor(() => {
    expect(view.initialized).toBe(true)
  }, delay)

  // synteny haplotype blocks drew
  const syntenyCanvas = await findByTestId('multi_synteny_canvas_done', ...opts)
  expectCanvasMatch(syntenyCanvas)

  // per-base variants from the vg deconstruct VCF drew in the same view.
  // MultiLGVSyntenyDisplay uses its own component (multi_synteny_canvas_done),
  // so the only `display-*-done` element here is the VCF track.
  const vcfDisplays = await findAllByTestId(/^display-.*-done$/, ...opts)
  expect(vcfDisplays).toHaveLength(1)
  expectCanvasMatch(findCanvasIn(vcfDisplays[0]!))
}, 90000)
