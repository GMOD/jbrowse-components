import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaF from './configSchemaF.ts'

// GMOD/jbrowse-components#5641: AGR's config, unchanged since v3
test('a v4 mouseover naming the mate titles the hover with it', () => {
  const conf = configSchemaF().create({
    type: 'LGVSyntenyDisplay',
    displayId: 'human2mouse.stringent.anchors-LGVSyntenyDisplay',
    mouseover: "jexl:get(feature,'mate').name",
  })
  expect(readConfObject(conf, ['tooltip', 'field'])).toBe(
    "jexl:get(feature,'mate').name",
  )
})
