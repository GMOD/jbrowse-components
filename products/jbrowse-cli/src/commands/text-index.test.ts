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
  setup
    .command(['text-index', '--individual'])
    .catch(err => {
      expect(err.message).toContain('please specify a track to index')
    })
    .it('fails if no track id is provided to the command with --individual flag.')
  setup
    .command(['text-index', '--individual', '--tracks=file1,gile2'])
    .catch(err =>{
      expect(err.message).toContain('--individual flag only allows one track to be indexed')
    })
    .it('fails if there are more than one track when using the individual flag')
  setup
    .command(['text-index', '--Command'])
    .catch(err =>{
      expect(err.message).toContain('Unexpected argument:')
    })
    .it('fails if there is an invalid flag')
  })
