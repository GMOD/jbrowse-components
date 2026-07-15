import fs from 'node:fs'
import path from 'node:path'

import { parseSTARFusionBuffer } from './STARFusionImport.ts'

test('starfusion import', () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    'starfusion_example.fusion_predictions.tsv',
  )
  expect(parseSTARFusionBuffer(fs.readFileSync(filepath))).toMatchSnapshot()
})
