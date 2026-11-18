import { setConf } from '@jbrowse/core/configuration'

import { createDisplay } from './testEnv.ts'

test('the gene name row takes room only while a name can draw', () => {
  const display = createDisplay()
  expect(display.geneLabelPx).toBeGreaterThan(0)
  setConf(display, ['labels', 'name', 'field'], '')
  expect(display.geneLabelPx).toBe(0)
  setConf(display, ['labels', 'name', 'field'], 'gene_name')
  expect(display.geneLabelPx).toBeGreaterThan(0)
  setConf(display, ['labels', 'name', 'show'], false)
  expect(display.geneLabelPx).toBe(0)
})
