import { render, cleanup, fireEvent, wait } from 'react-testing-library'
import React from 'react'
import { createTestEnv } from '../../../JBrowse'
import AssemblyEditorDrawerWidget from './AssemblyEditorDrawerWidget'

jest.mock('popper.js', () => {
  const PopperJS = jest.requireActual('popper.js')
  return class Popper {
    static placements = PopperJS.placements

    constructor() {
      return {
        destroy: () => {},
        scheduleUpdate: () => {},
      }
    }
  }
})

describe('<AssemblyEditorDrawerWidget />', () => {
  let model

  beforeAll(async () => {
    const { rootModel } = await createTestEnv({
      configId: 'testing',
      assemblies: {
        volvox: {
          configId: 'volvox',
          aliases: ['vvx'],
          refNameAliases: {
            adapter: {
              type: 'FromConfigAdapter',
              refNameAliases: [
                {
                  refName: 'ctgA',
                  aliases: ['A', 'contigA'],
                },
                {
                  refName: 'ctgB',
                  aliases: ['B', 'contigB'],
                },
              ],
            },
          },
          sequence: {
            configId: 'iTo6LoXUeJ',
            type: 'ReferenceSequence',
            adapter: {
              configId: 'Zd0NLmtxPZ3',
              type: 'FromConfigAdapter',
              regions: [
                {
                  refName: 'fakeContig',
                  start: 0,
                  end: 1000,
                },
              ],
            },
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

  afterEach(cleanup)

  it('renders', async () => {
    const { container, getByText } = render(
      <AssemblyEditorDrawerWidget model={model} />,
    )
    await wait(() => getByText('volvox'))
    expect(container.firstChild).toMatchSnapshot()
  })

  it('opens and closes dialog on FAB click', async () => {
    const { getByTestId, getByText } = render(
      <AssemblyEditorDrawerWidget model={model} />,
    )
    await wait(() => getByText('volvox'))
    expect(() => getByText(/Enter the name/)).toThrow()
    fireEvent.click(getByTestId('AssemblyEditorDrawerWidgetFAB'))
    expect(getByTestId('AssemblyEditorDrawerWidgetAddPopper')).toMatchSnapshot()
    fireEvent.click(getByTestId('AssemblyEditorDrawerWidgetFAB'))
    expect(getByTestId('AssemblyEditorDrawerWidgetAddPopper')).toMatchSnapshot()
  })

  it('opens and closes dialog on help click', async () => {
    const { getByTestId, getByText } = render(
      <AssemblyEditorDrawerWidget model={model} />,
    )
    await wait(() => getByText('volvox'))
    expect(() => getByText(/JBrowse uses the assemblies/)).toThrow()
    fireEvent.click(getByTestId('AssemblyEditorDrawerWidgetHelpButton'))
    expect(
      getByTestId('AssemblyEditorDrawerWidgetHelpPopper'),
    ).toMatchSnapshot()
    fireEvent.click(getByTestId('AssemblyEditorDrawerWidgetHelpButton'))
    expect(
      getByTestId('AssemblyEditorDrawerWidgetHelpPopper'),
    ).toMatchSnapshot()
  })

  it('adds an assembly', async () => {
    const { getByTestId, getByText, getByDisplayValue } = render(
      <AssemblyEditorDrawerWidget model={model} />,
    )
    await wait(() => getByText('volvox'))
    fireEvent.click(getByTestId('AssemblyEditorDrawerWidgetFAB'))
    fireEvent.change(getByDisplayValue(''), {
      target: { value: 'testAssembly' },
    })
    fireEvent.click(getByTestId('AssemblyEditorDrawerWidgetSubmitButton'))
    await wait(() => getByText('testAssembly'))

    // expect(getByTestId('AssemblyEditorDrawerWidgetAddPopper')).toMatchSnapshot()
    // fireEvent.click(getByTestId('AssemblyEditorDrawerWidgetFAB'))
    // expect(getByTestId('AssemblyEditorDrawerWidgetAddPopper')).toMatchSnapshot()

    // const wrapper = shallow(<AssemblyEditorDrawerWidget model={model} />)
    // const instance = wrapper.instance()
    // instance.handleNewAssemblyChange({ target: { value: 'abc' } })
    // expect(wrapper.state('newAssemblyName')).toBe('abc')
    // instance.handleAddAssembly({ target: 'theAddAssemblyButton' })
    // expect(wrapper).toMatchSnapshot()
  })
})
