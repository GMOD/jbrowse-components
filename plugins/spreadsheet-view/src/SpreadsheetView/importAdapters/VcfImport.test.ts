import fs from 'fs'
import path from 'path'

import { parseVcfBuffer } from './VcfImport'

test('vcf file import', () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    '1801160099-N32519_26611_S51_56704.hard-filtered.vcf',
  )
  expect(parseVcfBuffer(fs.readFileSync(filepath))).toMatchSnapshot()
})
