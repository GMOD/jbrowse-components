import {
  findByTestId,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Multi-Way Synteny Views',
  tests: [
    {
      name: '3-way synteny view (volvox ins/del)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearSyntenyView',
              tracks: [['volvox_ins.paf'], ['volvox_del.paf']],
              views: [
                { loc: 'ctgA:1-50000', assembly: 'volvox_ins' },
                { loc: 'ctgA:1-50000', assembly: 'volvox' },
                { loc: 'ctgA:1-50000', assembly: 'volvox_del' },
              ],
            },
          ],
        })

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await canvasSnapshot(
          page,
          'multiway-synteny-3way-canvas',
          '[data-testid="synteny_canvas"]',
        )
      },
    },
    {
      name: '3-way synteny full page screenshot',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearSyntenyView',
              tracks: [['volvox_ins.paf'], ['volvox_del.paf']],
              views: [
                { loc: 'ctgA:1-50000', assembly: 'volvox_ins' },
                { loc: 'ctgA:1-50000', assembly: 'volvox' },
                { loc: 'ctgA:1-50000', assembly: 'volvox_del' },
              ],
            },
          ],
        })

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await pageSnapshot(page, 'multiway-synteny-3way-fullpage')
      },
    },
    {
      name: '2-way synteny with gene tracks (volvox)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearSyntenyView',
              tracks: ['volvox_fake_synteny'],
              views: [
                {
                  loc: 'ctgA:1-50000',
                  assembly: 'volvox',
                  tracks: ['gff3tabix_genes'],
                },
                {
                  loc: 'ctgA:1-50000',
                  assembly: 'volvox',
                  tracks: ['gff3tabix_genes'],
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await canvasSnapshot(
          page,
          'multiway-synteny-2way-with-genes-canvas',
          '[data-testid="synteny_canvas"]',
        )
      },
    },
    {
      name: 'dotplot view with grape vs peach (zoomed region)',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'DotplotView',
                tracks: ['subset'],
                views: [
                  { loc: 'Pp01:28,000,000..29,000,000', assembly: 'peach' },
                  { loc: 'chr1:200,000..500,000', assembly: 'grape' },
                ],
              },
            ],
          },
          'test_data/grape_peach_synteny/config.json',
        )

        await page.waitForSelector('[data-testid="dotplot_webgl_canvas"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="dotplot_webgl_canvas"]',
        )
        await canvasSnapshot(
          page,
          'multiway-dotplot-grape-peach-zoomed-canvas',
          '[data-testid="dotplot_webgl_canvas"]',
        )
      },
    },
  ],
}

export default suite
