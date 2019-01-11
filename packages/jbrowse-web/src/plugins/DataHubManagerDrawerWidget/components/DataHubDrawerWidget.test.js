import { createShallow, getClasses } from '@material-ui/core/test-utils'
import React from 'react'
import JBrowse from '../../../JBrowse'
import DataHubDrawerWidget from './DataHubDrawerWidget'

describe('DataHubManager drawer widget', () => {
  let shallow
  let classes
  let jbrowse
  let rootModel

  beforeAll(() => {
    shallow = createShallow({ untilSelector: 'DataHubDrawerWidget' })
    classes = getClasses(<DataHubDrawerWidget rootModel={rootModel} />)
    jbrowse = new JBrowse().configure({ _configId: 'testing' })
    rootModel = jbrowse.model
  })

  it('renders', () => {
    const wrapper = shallow(<DataHubDrawerWidget rootModel={rootModel} />)
    expect(wrapper).toMatchSnapshot()
    expect(wrapper.hasClass(classes.root)).toBe(true)
    expect(wrapper.find('WithStyles(Stepper)').hasClass(classes.stepper)).toBe(
      true,
    )
    expect(
      wrapper
        .find('WithStyles(Button)')
        .at(0)
        .hasClass(classes.button),
    ).toBe(true)
    expect(
      wrapper
        .find(`div.${classes.actionsContainer}`)
        .at(0)
        .hasClass(classes.actionsContainer),
    ).toBe(true)
    expect(
      wrapper
        .find(`div.${classes.actionsContainer}`)
        .at(0)
        .hasClass(classes.actionsContainer),
    ).toBe(true)
  })

  it('can handle a custom UCSC URL', () => {
    const wrapper = shallow(<DataHubDrawerWidget rootModel={rootModel} />)
    expect(wrapper).toMatchSnapshot()
    const instance = wrapper.instance()
    instance.setHubType({ target: { value: 'ucsc' } })
    instance.enableNextThrough(0)
    instance.handleNext()
    instance.handleBack()
    instance.handleNext()
    instance.setHubSource({ target: { value: 'ucscCustom' } })
    instance.enableNextThrough(1)
    instance.handleNext()
    instance.setTrackDbUrl(new URL('http://www.example.com/trackDb.txt'))
    instance.setHubName('testHubName')
    instance.setAssemblyName('testAssemblyName')
    instance.enableNextThrough(2)
    instance.handleNext()
    instance.enableNextThrough(3)
    instance.handleNext()
    expect(wrapper).toMatchSnapshot()
  })
})
