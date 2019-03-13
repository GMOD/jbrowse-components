import { createShallow, createMount } from '@material-ui/core/test-utils'
import React from 'react'
import { createTestEnv } from '../../../JBrowse'
import ConfirmTrack, { guessAdapter } from './ConfirmTrack'

jest.mock('shortid', () => ({ generate: () => 'testid' }))

describe('<ConfirmTrack />', () => {
  let shallow
  let mount
  let rootModel

  beforeAll(async () => {
    shallow = createShallow()
    mount = createMount()
    ;({ rootModel } = await createTestEnv({ configId: 'testing' }))
  })

  it('shallowly renders', () => {
    const mockFunction = () => {}
    const wrapper = shallow(
      <ConfirmTrack
        rootModel={rootModel}
        trackData={{ uri: 'test.bam' }}
        trackName=""
        updateTrackName={mockFunction}
        trackType="AlignmentsTrack"
        updateTrackType={mockFunction}
        trackAdapter={{
          type: 'BamAdapter',
          bamLocation: { uri: 'test.bam' },
          index: { location: { uri: 'test.bam.bai' } },
        }}
        updateTrackAdapter={mockFunction}
      />,
    )
    expect(wrapper).toMatchSnapshot()
  })

  it('mounts with uri', () => {
    const mockFunction = jest.fn(() => {})
    const preWrap = shallow(
      <ConfirmTrack
        rootModel={rootModel}
        trackData={{ uri: 'test.bam' }}
        trackName=""
        updateTrackName={mockFunction}
        trackType="AlignmentsTrack"
        updateTrackType={mockFunction}
        trackAdapter={{
          type: 'BamAdapter',
          bamLocation: { uri: 'test.bam' },
          index: { location: { uri: 'test.bam.bai' } },
        }}
        updateTrackAdapter={mockFunction}
      />,
    )
    const wrapper = mount(preWrap.shallow().get(0))
    expect(wrapper).toMatchSnapshot()
    expect(mockFunction.mock.calls.length).toBe(2)
  })

  it('mounts with localPath', () => {
    const mockFunction = jest.fn(() => {})
    const preWrap = shallow(
      <ConfirmTrack
        rootModel={rootModel}
        trackData={{ localPath: 'test.bam' }}
        trackName=""
        updateTrackName={mockFunction}
        trackType="AlignmentsTrack"
        updateTrackType={mockFunction}
        trackAdapter={{
          type: 'BamAdapter',
          bamLocation: { localPath: 'test.bam' },
          index: { location: { localPath: 'test.bam.bai' } },
        }}
        updateTrackAdapter={mockFunction}
      />,
    )
    const wrapper = mount(preWrap.shallow().get(0))
    expect(wrapper).toMatchSnapshot()
    expect(mockFunction.mock.calls.length).toBe(2)
  })

  it('mounts with config', () => {
    const mockFunction = jest.fn(() => {})
    const preWrap = shallow(
      <ConfirmTrack
        rootModel={rootModel}
        trackData={{ uri: 'test.bam', config: [] }}
        trackName=""
        updateTrackName={mockFunction}
        trackType="AlignmentsTrack"
        updateTrackType={mockFunction}
        trackAdapter={{
          type: 'FromConfigAdapter',
        }}
        updateTrackAdapter={mockFunction}
      />,
    )
    const wrapper = mount(preWrap.shallow().get(0))
    expect(wrapper).toMatchSnapshot()
    expect(mockFunction.mock.calls.length).toBe(3)
  })

  it('provides an appropriate adapter for known file types', () => {})
  const fileList = [
    'test.bam',
    'test.bai',
    'test.bam.csi',
    'test.cram',
    'test.crai',
    'test.gff3',
    'test.gff3.gz',
    'test.gff3.gz.tbi',
    'test.gff3.gz.csi',
    'test.gtf',
    'test.vcf',
    'test.vcf.gz',
    'test.vcf.gz.tbi',
    'test.vcf.gz.csi',
    'test.vcf.idx',
    'test.bed',
    'test.bed.gz',
    'test.bed.gz.tbi',
    'test.bed.gz.csi',
    'test.bed.idx',
    'test.bb',
    'test.bigbed',
    'test.bw',
    'test.bigwig',
    'test.fa',
    'test.fa.fai',
    'test.fa.gz',
    'test.fa.gz.fai',
    'test.fa.gz.gzi',
    'test.fasta',
    'test.fasta.fai',
    'test.fasta.gz',
    'test.fasta.gz.fai',
    'test.fasta.gz.gzi',
    'test.fna',
    'test.fna.fai',
    'test.fna.gz',
    'test.fna.gz.fai',
    'test.fna.gz.gzi',
    'test.mfa',
    'test.mfa.fai',
    'test.mfa.gz',
    'test.mfa.gz.fai',
    'test.mfa.gz.gzi',
    'test.2bit',
    'test.sizes',
  ]
  fileList.forEach(fileName => {
    const adapter = guessAdapter(fileName, 'uri')
    expect(adapter.type).not.toBeUndefined()
  })
})
