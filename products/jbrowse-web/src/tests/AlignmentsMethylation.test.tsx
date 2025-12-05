import path from 'path'

import { testAlignmentModificationsDisplay } from './testAlignmentModificationsDisplay'
import { setupTest } from './util'
import config from '../../test_data/methylation_test/config.json'

setupTest(url =>
  require.resolve(`../../test_data/methylation_test/${path.basename(url)}`),
)

test('color by methylation', async () => {
  await testAlignmentModificationsDisplay({
    config,
    canvasTestId: 'prerendered_canvas_{hg38_clip}20:13433..13524-0_done',
  })
}, 60000)
