import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaFactory from './configSchema.ts'
import {
  DEFAULT_MIN_INTERCHROM_SUPPORT,
  DEFAULT_MIN_SASHIMI_SCORE,
} from './constants.ts'

// Two numbers are written down twice on purpose, and nothing until now checked
// that the two copies agree.
//
// The config slot has to spell its default as a LITERAL, because the config
// docgen renders it by reading the AST node's source text — a reference to the
// constant would publish the identifier name instead of the value. So
// `constants.ts` names the same number again for the menu, which needs it for
// the reset item and the is-default marker. Both declarations carry a "keep the
// two in step" comment, which is exactly the kind of instruction that goes
// stale: whoever changes a default changes the one they were looking at.
//
// The drift is quiet. The slot's value is what a fresh track gets, so the menu
// would open showing that value with the is-default tick absent, and "Reset"
// would set a number that is not the default — a control that visibly does
// something and lands somewhere wrong.
function displayConf() {
  return configSchemaFactory(new PluginManager()).create({
    type: 'LinearAlignmentsDisplay',
    displayId: 'parity',
  })
}

test('the sashimi menu constant is the minSashimiScore slot default', () => {
  expect(readConfObject(displayConf(), 'minSashimiScore')).toBe(
    DEFAULT_MIN_SASHIMI_SCORE,
  )
})

test('the arc menu constant is the minInterchromSupport slot default', () => {
  expect(readConfObject(displayConf(), 'minInterchromSupport')).toBe(
    DEFAULT_MIN_INTERCHROM_SUPPORT,
  )
})
