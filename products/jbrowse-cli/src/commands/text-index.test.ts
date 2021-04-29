/**
 * @jest-environment node
 */

import { setup } from '../testUtil'

// Test throwing an error if --tracks and no track ids provided
describe('indexGff3', () => {
  setup
    .command(['text-index', '--tracks'])
    .catch(err => {
      expect(err.message).toContain('--tracks expects a value')
    })
    .it('fails if no track ids are provided to the command with --tracks flag.')
})
