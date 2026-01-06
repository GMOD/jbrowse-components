import path from 'path'

import { testAlignmentModificationsDisplay } from './testAlignmentModificationsDisplay.tsx'
import { doBeforeEach, setup } from './util.tsx'
import config from '../../test_data/methylation_test/config.json'

setup()

beforeEach(() => {
  doBeforeEach(url =>
    require.resolve(`../../test_data/methylation_test/${path.basename(url)}`),
  )
})

test('color by methylation', async () => {
  await testAlignmentModificationsDisplay({
    config,
    canvasTestId: 'prerendered_canvas_{hg38_clip}20:13433..13524-0_done',
  })
}, 60000)
