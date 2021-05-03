/**
 * @jest-environment node
 */

import { setup } from '../testUtil'
import TextIndex from './text-index'
import { createReadStream } from 'fs'

// Test throwing an error if --tracks and no track ids provided
describe('textIndexCommandErrors', () => {
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

describe('indexGff3', () => {
  setup
    .command(['text-index', '--tracks'])
    .catch(err => {
      expect(err.message).toContain('--tracks expects a value')
    })
    .it('fails if no track ids are provided to the command with --tracks flag.')
  })


describe('indexGff3', () => {
  const gff3FileName2: string = "./products/jbrowse-cli/test/data/au9_scaffold_subset_sync.gff3"
  const gff3In = createReadStream(gff3FileName2)
  it(`Index ./test/data into out.ix and out.ixx`, async () => {
    // parseGff
    let textIndex = new TextIndex([], null)
    textIndex.log = jest.fn()
    textIndex.parseGff3(gff3In, true)
    expect(textIndex.log).toHaveBeenCalledWith(`Indexing done! Check out.ix and out.ixx files for output.`)
  })
  // it('console.log the text "hello"', () => {
    // let textIndex = new TextIndex([], null)
    // textIndex.log = jest.fn();
    // textIndex.log('hello');
    // The first argument of the first call to the function was 'hello'
    // expect(textIndex.log).toHaveBeenCalledWith('hello');
  // })
  
  
})