import { createMount, createShallow } from '@material-ui/core/test-utils'
import { clone } from 'mobx-state-tree'
import React from 'react'
import JBrowse from '../../../JBrowse'
import ConfirmationDialog from './ConfirmationDialog'

describe('<ConfirmationDialog />', () => {
  let shallow
  let mount
  //   let classes
  let jbrowse
  let rootModel

  beforeAll(() => {
    shallow = createShallow({ untilSelector: 'ConfirmationDialog' })
    mount = createMount()
    // classes = getClasses(<ConfirmationDialog rootModel={rootModel} />)
    jbrowse = new JBrowse().configure({
      configId: 'testing',
      rpc: { configId: 'rpcConfig' },
    })
    rootModel = jbrowse.model
    const firstView = rootModel.addView(
      'LinearGenomeView',
      {
        configId: 'testViewConfigId',
      },
      { id: 'testViewId' },
    )
    firstView.activateTrackSelector()
  })

  afterAll(() => {
    mount.cleanUp()
  })

  it('shallowly renders', () => {
    const wrapper = shallow(
      <ConfirmationDialog
        trackDbUrl={new URL('http://localhost:3000/trackDb.txt')}
        assemblyName="hg38"
        hubName="TestHub"
        enableNext={() => {}}
        rootModel={clone(rootModel)}
      />,
    )
    expect(wrapper).toMatchSnapshot()
  })

  it('mounts', async () => {
    const mockFetch = () =>
      Promise.resolve(
        new Response(
          `track dnaseSignal
bigDataUrl dnaseSignal.bigWig
shortLabel DNAse Signal
longLabel Depth of alignments of DNAse reads
type bigWig

track dnaseReads
bigDataUrl dnaseReads.bam
shortLabel DNAse Reads
longLabel DNAse reads mapped with MAQ
type bam
`,
        ),
      )
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    let instance
    const wrapper = mount(
      <ConfirmationDialog
        trackDbUrl={new URL('http://test.com/hg19/trackDb.txt')}
        innerRef={node => {
          instance = node
        }}
        assemblyName="hg38"
        hubName="TestHub"
        enableNext={() => {}}
        rootModel={clone(rootModel)}
      />,
    )

    await instance.componentDidMount()

    instance.toggleUnsupported()
    expect(wrapper).toMatchSnapshot()
  })

  it('handles 404', async () => {
    const mockFetch = () => Promise.resolve(new Response('', { status: 404 }))
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    let instance
    const wrapper = mount(
      <ConfirmationDialog
        trackDbUrl={new URL('http://test.com/trackDb.txt')}
        assemblyName="hg38"
        innerRef={node => {
          instance = node
        }}
        hubName="TestHub"
        enableNext={() => {}}
        rootModel={rootModel}
      />,
    )
    await instance.componentDidMount()
    expect(wrapper).toMatchSnapshot()
  })

  it('handles fetch error', async () => {
    const mockFetch = () => {
      throw new Error()
    }
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    let instance
    const wrapper = mount(
      <ConfirmationDialog
        trackDbUrl={new URL('http://test.com/trackDb.txt')}
        assemblyName="hg38"
        innerRef={node => {
          instance = node
        }}
        hubName="TestHub"
        enableNext={() => {}}
        rootModel={rootModel}
      />,
    )
    await instance.componentDidMount()
    expect(wrapper).toMatchSnapshot()
  })
})
