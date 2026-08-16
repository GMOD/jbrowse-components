import { render } from '@testing-library/react'

import PluginManager from '../PluginManager.ts'
import PluggableElements from './PluggableElements.tsx'
import { addExtensionElement } from './addExtensionElement.tsx'

// A `list` point renders every contribution, which is the property that keeps
// two plugins from taking the same overlay away from each other. The dotplot's
// HTML overlay used to be a `single` point with the dotplot plugin's own chip
// overlay already in the slot, so any second contributor silently won or lost.
//
// The point's props type is the LGV's, which core cannot name — asserted as
// never, the same way accumulatingExtensionPoint.test.tsx does.
const POINT = 'LinearGenomeView-TracksContainerComponent'

function Alpha() {
  return <div>alpha</div>
}
function Beta() {
  return <div>beta</div>
}

test('renders every contributed element', () => {
  const pm = new PluginManager([])
  addExtensionElement(pm, POINT, Alpha)
  addExtensionElement(pm, POINT, Beta)
  const { getByText } = render(
    <PluggableElements pluginManager={pm} name={POINT} props={{} as never} />,
  )
  expect(getByText('alpha')).toBeTruthy()
  expect(getByText('beta')).toBeTruthy()
})

test('renders nothing when no plugin contributes', () => {
  const pm = new PluginManager([])
  const { container } = render(
    <PluggableElements pluginManager={pm} name={POINT} props={{} as never} />,
  )
  expect(container.innerHTML).toBe('')
})

test('a contributor is passed the point props', () => {
  const pm = new PluginManager([])
  addExtensionElement(pm, POINT, ({ model }) => <div>{String(model)}</div>)
  const { getByText } = render(
    <PluggableElements
      pluginManager={pm}
      name={POINT}
      props={{ model: 'the-model' } as never}
    />,
  )
  expect(getByText('the-model')).toBeTruthy()
})
