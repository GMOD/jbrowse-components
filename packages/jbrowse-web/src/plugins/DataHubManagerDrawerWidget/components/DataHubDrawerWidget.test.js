import { createShallow, getClasses } from '@material-ui/core/test-utils'
import React from 'react'
import { createTestEnv } from '../../../JBrowse'
import DataHubDrawerWidget from './DataHubDrawerWidget'

describe('<DataHubDrawerWidget />', () => {
  let shallow
  let classes
  let model

  beforeAll(async () => {
    shallow = createShallow({ untilSelector: 'DataHubDrawerWidget' })
    const { rootModel } = await createTestEnv({
      configId: 'testing',
      defaultSession: {},
      rpc: { configId: 'testingRpc' },
    })
    rootModel.addDrawerWidget('DataHubDrawerWidget', 'dataHubDrawerWidget')
    model = rootModel.drawerWidgets.get('dataHubDrawerWidget')
    classes = getClasses(<DataHubDrawerWidget model={model} />)
  })

  it('renders', () => {
    const wrapper = shallow(<DataHubDrawerWidget model={model} />)
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
    const wrapper = shallow(<DataHubDrawerWidget model={model} />)
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

  it('can handle a custom UCSC URL', () => {
    const wrapper = shallow(<DataHubDrawerWidget model={model} />)
    expect(wrapper).toMatchSnapshot()
    const instance = wrapper.instance()
    instance.setHubType({ target: { value: 'ucsc' } })
    instance.enableNextThrough(0)
    instance.handleNext()
    instance.handleBack()
    instance.handleNext()
    instance.setHubSource({ target: { value: 'trackHubRegistry' } })
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
