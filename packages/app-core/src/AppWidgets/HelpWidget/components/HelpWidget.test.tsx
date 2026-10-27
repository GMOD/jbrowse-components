import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'
import { render } from '@testing-library/react'

import HelpWidget from './HelpWidget.tsx'

function sessionWithViews(views: ViewType[]) {
  return types
    .model({
      configuration: ConfigurationSchema('Null', {}),
      widgetModel: types.model({ type: types.literal('HelpWidget') }),
    })
    .volatile(() => ({ rpcManager: {} }))
    .create(
      { widgetModel: { type: 'HelpWidget' } },
      { pluginManager: { getViewElements: () => views } },
    )
}

function viewType(
  name: string,
  keyboardShortcuts?: ViewType['keyboardShortcuts'],
) {
  return new ViewType({
    name,
    displayName: `${name} view`,
    stateModel: types.model(name, {}),
    ReactComponent: () => null,
    keyboardShortcuts,
  })
}

describe('<HelpWidget />', () => {
  it('renders', () => {
    const { container } = render(<HelpWidget />)
    expect(container).toMatchSnapshot()
  })

  it('lists the shortcuts each view type registers, under its name', () => {
    const session = sessionWithViews([
      viewType('Plain'),
      viewType('Keyed', [{ keys: 'Ctrl + K', description: 'Do the thing' }]),
    ])
    const { getByText, queryByText } = render(
      <HelpWidget model={session.widgetModel} />,
    )
    expect(getByText('Keyed view')).toBeTruthy()
    expect(getByText('Ctrl + K')).toBeTruthy()
    expect(getByText('Do the thing')).toBeTruthy()
    expect(queryByText('Plain view')).toBeNull()
  })
})
