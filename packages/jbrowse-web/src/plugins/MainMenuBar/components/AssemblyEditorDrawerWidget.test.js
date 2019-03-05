import { createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import { createTestEnv } from '../../../JBrowse'
import AssemblyEditorDrawerWidget from './AssemblyEditorDrawerWidget'

describe('<AssemblyEditorDrawerWidget />', () => {
  let shallow
  let model

  beforeAll(async () => {
    shallow = createShallow({ untilSelector: 'DataHubDrawerWidget' })
    const { rootModel } = await createTestEnv({
      configId: 'testing',
      assemblies: {
        volvox: {
          aliases: ['vvx'],
          refNameAliases: {
            A: ['ctgA', 'contigA'],
            B: ['ctgB', 'contigB'],
          },
        },
      },
    })
    rootModel.addDrawerWidget(
      'HierarchicalTrackSelectorDrawerWidget',
      'hierarchicalTrackSelectorDrawerWidget',
    )
    model = rootModel.drawerWidgets.get('hierarchicalTrackSelectorDrawerWidget')
  })

  it('renders', () => {
    const wrapper = shallow(<AssemblyEditorDrawerWidget model={model} />)
    expect(wrapper).toMatchSnapshot()
  })

  it('opens and closes dialog on FAB click', () => {
    const wrapper = shallow(<AssemblyEditorDrawerWidget model={model} />)
    const instance = wrapper.instance()
    const fabButton = wrapper.find('WithStyles(Fab)')
    // Click menu button to open
    instance.handleFabClick({ currentTarget: fabButton })
    expect(wrapper).toMatchSnapshot()
    // Click menu button again to close (two events, one for menu click and one for ClickAwayListener)
    instance.handleFabClose({ target: 'add' })
    expect(wrapper).toMatchSnapshot()
    instance.handleFabClick({ currentTarget: fabButton })
    expect(wrapper).toMatchSnapshot()
    // Click menu button to open
    instance.handleFabClick({ currentTarget: fabButton })
    expect(wrapper).toMatchSnapshot()
    // Click somewhere else on page to close with ClickAwayListener
    instance.handleFabClose({ target: 'somewhereElseOnPage' })
    expect(wrapper).toMatchSnapshot()
  })

  it('opens and closes dialog on help click', () => {
    const wrapper = shallow(<AssemblyEditorDrawerWidget model={model} />)
    const instance = wrapper.instance()
    const helpButton = wrapper.find('WithStyles(IconButton)')
    // Click menu button to open
    instance.handleHelpClick({ currentTarget: helpButton })
    expect(wrapper).toMatchSnapshot()
    // Click menu button again to close (two events, one for menu click and one for ClickAwayListener)
    instance.handleHelpClose({ target: 'help' })
    expect(wrapper).toMatchSnapshot()
    instance.handleHelpClick({ currentTarget: helpButton })
    expect(wrapper).toMatchSnapshot()
    // Click menu button to open
    instance.handleHelpClick({ currentTarget: helpButton })
    expect(wrapper).toMatchSnapshot()
    // Click somewhere else on page to close with ClickAwayListener
    instance.handleHelpClose({ target: 'somewhereElseOnPage' })
    expect(wrapper).toMatchSnapshot()
  })

  it('adds an assembly', () => {
    const wrapper = shallow(<AssemblyEditorDrawerWidget model={model} />)
    const instance = wrapper.instance()
    instance.handleNewAssemblyChange({ target: { value: 'abc' } })
    expect(wrapper.state('newAssemblyName')).toBe('abc')
    instance.handleAddAssembly({ target: 'theAddAssemblyButton' })
    expect(wrapper).toMatchSnapshot()
  })
})
