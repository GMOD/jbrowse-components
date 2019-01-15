import { HubFile } from '@gmod/ucsc-hub'
import { createMount, createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import GenomeSelector from './GenomeSelector'

describe('<GenomeSelector />', () => {
  let shallow
  let mount
  let hubTxt

  beforeAll(() => {
    shallow = createShallow({ untilSelector: 'GenomeSelector' })
    mount = createMount()
    hubTxt = new HubFile(
      `hub TestHub
shortLabel Test Hub
longLabel Test Genome Informatics Hub for human DNase and RNAseq data
genomesFile genomes.txt
email genome@test.com
descriptionUrl test.html
`,
    )
  })

  afterAll(() => {
    mount.cleanUp()
  })

  it('shallowly renders', () => {
    const wrapper = shallow(
      <GenomeSelector
        hubTxtUrl={new URL('http://localhost:3000/hub.txt')}
        hubTxt={hubTxt}
        setTrackDbUrl={() => {}}
        setAssemblyName={() => {}}
      />,
    )
    expect(wrapper).toMatchSnapshot()
  })

  it('mounts', async () => {
    const mockFetch = () =>
      Promise.resolve(
        new Response(
          `genome hg19
trackDb hg19/trackDb.txt
`,
        ),
      )
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    const wrapper = mount(
      <GenomeSelector
        hubTxtUrl={new URL('http://localhost:3000/hub.txt')}
        hubTxt={hubTxt}
        setTrackDbUrl={() => {}}
        setAssemblyName={() => {}}
      />,
    )
    const instance = wrapper.instance()
    await instance.componentDidMount()
    expect(wrapper).toMatchSnapshot()
  })
})
