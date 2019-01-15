import {
  createShallow,
  createMount,
  getClasses,
} from '@material-ui/core/test-utils'
import React from 'react'
import UrlInput from './UrlInput'

describe('<UrlInput />', () => {
  let shallow
  let classes
  let mount

  beforeAll(() => {
    shallow = createShallow({ untilSelector: 'UrlInput' })
    mount = createMount()
    classes = getClasses(
      <UrlInput
        enableNext={() => {}}
        disableNext={() => {}}
        setTrackDbUrl={() => {}}
        setHubName={() => {}}
        setAssemblyName={() => {}}
      />,
    )
  })

  it('renders', () => {
    const wrapper = shallow(
      <UrlInput
        enableNext={() => {}}
        disableNext={() => {}}
        setTrackDbUrl={() => {}}
        setHubName={() => {}}
        setAssemblyName={() => {}}
      />,
    )
    expect(wrapper).toMatchSnapshot()
    expect(wrapper.find('TextField').hasClass(classes.textField)).toBe(true)
    expect(
      wrapper.find('WithStyles(Button)').hasClass(classes.validateButton),
    ).toBe(true)
  })

  it('mounts and validates a URL', async () => {
    const mockFetch = () =>
      Promise.resolve(
        new Response(
          `hub TestHub
shortLabel Test Hub
longLabel Test Genome Informatics Hub for human DNase and RNAseq data
genomesFile genomes.txt
email genome@test.com
descriptionUrl test.html
`,
          { url: 'http://test.com/hub.txt' },
        ),
      )
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    const wrapper = mount(
      <UrlInput
        enableNext={() => {}}
        disableNext={() => {}}
        setTrackDbUrl={() => {}}
        setHubName={() => {}}
        setAssemblyName={() => {}}
      />,
    )
    expect(wrapper).toMatchSnapshot()
    const instance = wrapper.find('UrlInput').instance()
    instance.handleChange({ target: { value: 'http://test.com/hub.txt' } })
    await instance.validateUrl()
    expect(wrapper).toMatchSnapshot()
  })

  it('handles 404', async () => {
    const mockFetch = () =>
      Promise.resolve(
        new Response('', { status: 404, url: 'http://test.com/hub.txt' }),
      )
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    const wrapper = mount(
      <UrlInput
        enableNext={() => {}}
        disableNext={() => {}}
        setTrackDbUrl={() => {}}
        setHubName={() => {}}
        setAssemblyName={() => {}}
      />,
    )
    const instance = wrapper.find('UrlInput').instance()
    instance.handleChange({ target: { value: 'http://test.com/hub.txt' } })
    await instance.validateUrl()
    expect(wrapper).toMatchSnapshot()
  })

  it('handles fetch error', async () => {
    const mockFetch = () => {
      throw new Error()
    }
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    const wrapper = mount(
      <UrlInput
        enableNext={() => {}}
        disableNext={() => {}}
        setTrackDbUrl={() => {}}
        setHubName={() => {}}
        setAssemblyName={() => {}}
      />,
    )
    const instance = wrapper.find('UrlInput').instance()
    instance.handleChange({ target: { value: 'http://test.com/hub.txt' } })
    await instance.validateUrl()
    expect(wrapper).toMatchSnapshot()
  })
})
