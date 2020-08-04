import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { guessAdapter } from '@gmod/jbrowse-core/util/tracks'
import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import ConfirmTrack from './ConfirmTrack'

// note work on this tomorrow, fix confirm track to work with alignments tracks
describe('<ConfirmTrack />', () => {
  let session

  beforeAll(() => {
    session = createTestSession()
  })

  afterEach(cleanup)

  it('renders', () => {
    const mockFunction = () => {}
    const { container } = render(
      <ConfirmTrack
        session={session}
        trackData={{ uri: 'test.bam' }}
        trackName=""
        setTrackName={mockFunction}
        trackType="AlignmentsTrack"
        setTrackType={mockFunction}
        trackAdapter={{
          type: 'BamAdapter',
          bamLocation: { uri: 'test.bam' },
          index: { location: { uri: 'test.bam.bai' } },
        }}
        setTrackAdapter={mockFunction}
        assembly=""
        setAssembly={mockFunction}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('mounts with uri', () => {
    const mockFunction = jest.fn(() => {})
    const { container } = render(
      <ConfirmTrack
        session={session}
        trackData={{ uri: 'test.bam' }}
        trackName=""
        setTrackName={mockFunction}
        trackType="AlignmentsTrack"
        setTrackType={mockFunction}
        trackAdapter={{
          type: 'BamAdapter',
          bamLocation: { uri: 'test.bam' },
          index: { location: { uri: 'test.bam.bai' } },
        }}
        setTrackAdapter={mockFunction}
        assembly=""
        setAssembly={mockFunction}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
    expect(mockFunction.mock.calls.length).toBe(2)
  })

  it('mounts with localPath', () => {
    const mockFunction = jest.fn(() => {})
    const { container } = render(
      <ConfirmTrack
        session={session}
        trackData={{ localPath: 'test.bam' }}
        trackName=""
        setTrackName={mockFunction}
        trackType="AlignmentsTrack"
        setTrackType={mockFunction}
        trackAdapter={{
          type: 'BamAdapter',
          bamLocation: { localPath: 'test.bam' },
          index: { location: { localPath: 'test.bam.bai' } },
        }}
        setTrackAdapter={mockFunction}
        assembly=""
        setAssembly={mockFunction}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
    expect(mockFunction.mock.calls.length).toBe(2)
  })

  it('mounts with config', () => {
    const mockFunction = jest.fn(() => {})
    const { container } = render(
      <ConfirmTrack
        session={session}
        trackData={{ uri: 'test.bam', config: [] }}
        trackName=""
        setTrackName={mockFunction}
        trackType="AlignmentsTrack"
        setTrackType={mockFunction}
        trackAdapter={{
          type: 'FromConfigAdapter',
        }}
        setTrackAdapter={mockFunction}
        assembly=""
        setAssembly={mockFunction}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
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

  // tests cause Coverage track mounts differently
  it('renders SNPCoverageTrack with a subadapter', () => {
    const mockFunction = () => {}
    const { container } = render(
      <ConfirmTrack
        session={session}
        trackData={{ uri: 'test.bam' }}
        trackName=""
        setTrackName={mockFunction}
        trackType="SNPCoverageTrack"
        setTrackType={mockFunction}
        trackAdapter={{
          type: 'SNPCoverageAdapter',
          subadapter: {
            type: 'BamAdapter',
            bamLocation: { uri: 'test.bam' },
            index: { location: { uri: 'test.bam.bai' } },
          },
        }}
        setTrackAdapter={mockFunction}
        assembly=""
        setAssembly={mockFunction}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
  it('SNPCoverageTrack mounts with uri', () => {
    const mockFunction = jest.fn(() => {})
    const { container } = render(
      <ConfirmTrack
        session={session}
        trackData={{ uri: 'test.bam' }}
        trackName=""
        setTrackName={mockFunction}
        trackType="SNPCoverageTrack"
        setTrackType={mockFunction}
        trackAdapter={{
          type: 'SNPCoverageAdapter',
          subadapter: {
            type: 'BamAdapter',
            bamLocation: { uri: 'test.bam' },
            index: { location: { uri: 'test.bam.bai' } },
          },
        }}
        setTrackAdapter={mockFunction}
        assembly=""
        setAssembly={mockFunction}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
    expect(mockFunction.mock.calls.length).toBe(2)
  })
})
