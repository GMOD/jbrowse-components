/**
 * @jest-environment node
 */

import { setup } from '../testUtil'
import TextIndex from './text-index'
import { createReadStream, readFileSync } from 'fs'

// Base text index command 
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

// Test for a local Gzipped file
describe('indexGff3', () => {
  const gff3FileLocation = './products/jbrowse-cli/test/data/volvox.sort.gff3.gz';
  let isTest = true;
  it(`Index local gzipped gff3 file into out.ix and out.ixx`, async () => {
    let textIndex = new TextIndex([], null)
    textIndex.log = jest.fn()

    await textIndex.parseLocalGff3(gff3FileLocation, true,  isTest);
    const ixdata = JSON.stringify(readFileSync('./products/jbrowse-cli/test/data/out.ix', {encoding:'utf8', flag:'r'}))
    expect(ixdata).toMatchSnapshot()
    const ixxData = JSON.stringify(readFileSync(('./products/jbrowse-cli/test/data/out.ixx'), {encoding: 'utf8', flag:'r'}))
    expect(ixxData).toMatchSnapshot()
  })
}) 

// Test for a local non-gzipped file
describe('indexGff3', () => {
  const gff3FileLocation = './products/jbrowse-cli/test/data/au9_scaffold_subset_sync.gff3';
  let isTest = true;
  it(`Index non-GZ local gff3 file into out.ix and out.ixx`, async () => {
    let textIndex = new TextIndex([], null)
    textIndex.log = jest.fn()

    await textIndex.parseLocalGff3(gff3FileLocation, false,  isTest);
    const ixdata = JSON.stringify(readFileSync('./products/jbrowse-cli/test/data/out.ix', {encoding:'utf8', flag:'r'}))
    expect(ixdata).toMatchSnapshot()
    const ixxData = JSON.stringify(readFileSync(('./products/jbrowse-cli/test/data/out.ixx'), {encoding: 'utf8', flag:'r'}))
    expect(ixxData).toMatchSnapshot()
  })
})

// Test for a remote https non-gzipped file
describe('indexGff3', () => {
  const gff3FileLocation = 'https://raw.githubusercontent.com/GMOD/jbrowse/master/tests/data/au9_scaffold_subset_sync.gff3'
  let isTest: boolean = true;
  it(`Index non-GZ remote https gff3 file into out.ix and out.ixx`, async () => {
    let textIndex = new TextIndex([], null)
    textIndex.log = jest.fn()

    await textIndex.parseGff3Url(gff3FileLocation, false, isTest);
    const ixdata = JSON.stringify(readFileSync('./products/jbrowse-cli/test/data/out.ix', {encoding:'utf8', flag:'r'}))
    expect(ixdata).toMatchSnapshot()
    const ixxData = JSON.stringify(readFileSync(('./products/jbrowse-cli/test/data/out.ixx'), {encoding: 'utf8', flag:'r'}))
    expect(ixxData).toMatchSnapshot()
  })  
})

// Test for a remote https gzipped file
describe('indexGff3', () => {
  const gff3FileLocation = 'https://github.com/GMOD/jbrowse-components/raw/cli_trix_indexer_stub/test_data/volvox/volvox.sort.gff3.gz';
  let isTest = true;
  it(`Index remote https gzipped gff3 file into out.ix and out.ixx`, async () => {
    let textIndex = new TextIndex([], null)
    textIndex.log = jest.fn()

    let promise = textIndex.parseGff3Url(gff3FileLocation, true, isTest)
    await promise;
    const ixdata = JSON.stringify(readFileSync('./products/jbrowse-cli/test/data/out.ix', {encoding:'utf8', flag:'r'}))
    expect(ixdata).toMatchSnapshot()
    const ixxData = JSON.stringify(readFileSync(('./products/jbrowse-cli/test/data/out.ixx'), {encoding: 'utf8', flag:'r'}))
    expect(ixxData).toMatchSnapshot()
  })
})

// Test for remote http gzipped file
// NOTE: This tests a big file and takes 20+ seconds. Jest would timeout and error, so this test is commented out.
// describe('indexGff3', () => {
//   const gff3FileLocation = 'http://128.206.12.216/drupal/sites/bovinegenome.org/files/data/umd3.1/Ensembl_Mus_musculus.NCBIM37.67.pep.all_vs_UMD3.1.gff3.gz';
//   let isTest = true;
//   it(`Index remote http gzipped gff3 file into out.ix and out.ixx`, async () => {
//     let textIndex = new TextIndex([], null)
//     textIndex.log = jest.fn()

//     await textIndex.parseGff3Url(gff3FileLocation, true, isTest)
//     const ixdata = JSON.stringify(readFileSync(('./products/jbrowse-cli/test/data/out.ix'), {encoding:'utf8', flag:'r'}))
//     expect(ixdata).toMatchSnapshot()
//     const ixxData = JSON.stringify(readFileSync(('./products/jbrowse-cli/test/data/out.ixx'), {encoding: 'utf8', flag:'r'}))
//     expect(ixxData).toMatchSnapshot()
//   })
// })

// Test for remote http non-gzipped file
  // test goes here but I'm not having any luck finding a non-gzipped http file link.


// Test grabbing the track configurations object.
describe('getIndexingConfigurations', () => {
  it(`Get the configuration for ['gff3tabix_genes']`, async () => {
    let textIndex = new TextIndex([], null)
    const trackIds: Array<string> = ['gff3tabix_genes']
    const indexConfig = await textIndex.getIndexingConfigurations(trackIds, { target: 'products/jbrowse-cli' })
    const uri = indexConfig[0].indexingConfiguration.gffLocation.uri;
    expect(indexConfig).toMatchSnapshot()
    expect(uri).toMatchSnapshot()
  })
})

// Test getting the track configurations and indexing it into out.ix and out.ixx.
describe('getIndexingConfigurations', () => {
  it(`Gets the configurations for ['gff3tabix_genes] and indexes it`, async () => {
    let textIndex = new TextIndex([], null)
    const trackIds: Array<string> = ['gff3tabix_genes']
    const indexConfig = await textIndex.getIndexingConfigurations(trackIds, { target: 'products/jbrowse-cli' })
    const uri: string = './products/jbrowse-cli/' + indexConfig[0].indexingConfiguration.gffLocation.uri;
    await textIndex.parseLocalGff3(uri, true, true)

    const ixdata = JSON.stringify(readFileSync(('./products/jbrowse-cli/test/data/out.ix'), {encoding:'utf8', flag:'r'}))
    const ixxData = JSON.stringify(readFileSync(('./products/jbrowse-cli/test/data/out.ixx'), {encoding: 'utf8', flag:'r'}))
    expect(ixxData).toMatchSnapshot()
    expect(ixdata).toMatchSnapshot()
    
  })
})