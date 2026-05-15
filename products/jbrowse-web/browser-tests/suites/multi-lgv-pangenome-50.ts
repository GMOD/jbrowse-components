import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const config = 'test_data/config_volvox_pangenome_50.json'

const suite: TestSuite = {
  name: 'MultiLGV 50-sample pangenome',
  tests: [
    {
      name: 'full genome canvas snapshot',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'ref#0',
                loc: 'ctgA:1-50001',
                tracks: [
                  {
                    trackId: 'volvox_pangenome_50_multi',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'multi-lgv-pangenome-50-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'full genome page snapshot',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'ref#0',
                loc: 'ctgA:1-50001',
                tracks: [
                  {
                    trackId: 'volvox_pangenome_50_multi',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await pageSnapshot(page, 'multi-lgv-pangenome-50-fullpage')
      },
    },
    {
      name: 'zoomed-in view with bubble CS',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'ref#0',
                loc: 'ctgA:100-300',
                tracks: [
                  {
                    trackId: 'volvox_pangenome_50_multi',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'multi-lgv-pangenome-50-zoomed-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      // Inversion region — vg deconstruct emits the ~4400 bp bubble as one
      // len(REF)==len(ALT) record where ALT == rc(REF). The cs:Z: projector
      // skips these (see project-vcf-to-cs-paf.py --large-substitution-
      // threshold) because cs has no way to encode "next N bp are inverted";
      // decomposing into per-base SNPs would falsely paint thousands of
      // point mutations. The minus-strand block label is the honest signal.
      name: 'inversion region — minus-strand block, no fake per-base SNPs',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'ref#0',
                loc: 'ctgA:3000-8500',
                tracks: [
                  {
                    trackId: 'volvox_pangenome_50_multi',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'multi-lgv-pangenome-50-inversion-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
  ],
}

export default suite
