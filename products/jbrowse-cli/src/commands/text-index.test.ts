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
    let textIndex = new TextIndex([], null)
    textIndex.log = jest.fn()

    // Test parsing of stream and running ixIxx.
    textIndex.parseGff3(gff3In, true)
    expect(textIndex.log).toHaveBeenCalledWith(`Indexing done! Check out.ix and out.ixx files for output.`)
  })  
})

//remote non-GZ file
// describe('indexGff3', () => {
//   const gff3FileLocation = 'https://raw.githubusercontent.com/GMOD/jbrowse/master/tests/data/au9_scaffold_subset_sync.gff3'
//   let isTest: boolean = true;
//   it(`Index remote gff3 file into out.ix and out.ixx`, async () => {
//     let textIndex = new TextIndex([], null)
//     // textIndex.log = jest.fn()

//     // Test parsing of stream and running ixIxx.
//     textIndex.parseGff3Url(gff3FileLocation, false, isTest);
//     // expect(exitCode).toEqual(0);
//     // expect(textIndex.log).toHaveBeenCalledWith(`Indexing done! Check out.ix and out.ixx files for output.`)
//   })  
// })


// remote GZ file
describe('indexGff3', () => {
  const gff3FileLocation = 'https://github.com/GMOD/jbrowse-components/raw/cli_trix_indexer/test_data/volvox/volvox.sort.gff3.gz';
  let isTest = true;
  it(`Index remote gzipped gff3 file into out.ix and out.ixx`, async () => {
    let textIndex = new TextIndex([], null)
    // textIndex.log = jest.fn()

    textIndex.parseGff3Url(gff3FileLocation, true, isTest);
    // expect(exitCode).toEqual(0);
    // expect(textIndex.log).toHaveBeenCalledWith(`Indexing done! Check out.ix and out.ixx files for output.`)
  })
})

//local gff3 file
// describe('indexGff3', () => {
//   const gff3FileLocation = './products/jbrowse-cli/test/data/au9_scaffold_subset_sync.gff3';
//   let isTest = true;
//   it(`Index local gff3 file into out.ix and out.ixx`, async () => {
//     let textIndex = new TextIndex([], null)
//     // textIndex.log = jest.fn()

//     textIndex.parseLocalGff3(createReadStream(gff3FileLocation), false,  isTest);
//     //expect(exitCode).toEqual(0);
//     // expect(textIndex.log).toHaveBeenCalledWith(`Indexing done! Check out.ix and out.ixx files for output.`)
//   })
// })


// local GZ
describe('indexGff3', () => {
  const gff3FileLocation = './products/jbrowse-cli/test/data/volvox.sort.gff3.gz';
  let isTest = true;
  it(`Index local gzipped gff3 file into out.ix and out.ixx`, async () => {
    let textIndex = new TextIndex([], null)
    textIndex.log = jest.fn()

    textIndex.parseLocalGff3(createReadStream(gff3FileLocation), true,  isTest);
    expect(textIndex.log).toHaveBeenCalledWith(`Indexing done! Check out.ix and out.ixx files for output.`)
  })
}) 