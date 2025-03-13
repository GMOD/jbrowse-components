import fs from 'fs'
import path from 'path'

import { expect, test } from 'vitest'

import { parseSTARFusionBuffer } from './STARFusionImport'

test('starfusion import', () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    'starfusion_example.fusion_predictions.tsv',
  )
  expect(parseSTARFusionBuffer(fs.readFileSync(filepath))).toMatchSnapshot()
})
