import { types } from '@jbrowse/mobx-state-tree'
import { render } from '@testing-library/react'

import { ContextMenuMixin } from './ContextMenuMixin.ts'
import DisplayChrome from './DisplayChrome.tsx'
import { TestChromeModel, stubFactory } from './chromeTestModel.ts'

import type { ContextMenuAnchor } from '@jbrowse/core/ui'
import type { Instance } from '@jbrowse/mobx-state-tree'

const MenuDisplay = types
  .compose(TestChromeModel, ContextMenuMixin<ContextMenuAnchor>())
  .views(() => ({
    contextMenuItems() {
      return [{ label: 'Probe item', onClick: () => {} }]
    },
  }))

function renderChrome(
  model: Instance<typeof TestChromeModel> | Instance<typeof MenuDisplay>,
) {
  return render(
    <DisplayChrome model={model} factory={stubFactory} testid="probe-display">
      {({ canvasRef }) => <canvas ref={canvasRef} />}
    </DisplayChrome>,
  )
}

test('the chrome draws the menu of a display composing ContextMenuMixin', async () => {
  const model = MenuDisplay.create({})
  const { findByText } = renderChrome(model)
  model.openContextMenu({ clientX: 10, clientY: 10 })
  await findByText('Probe item')
})

test('a display with no menu gets none', () => {
  const model = TestChromeModel.create({})
  const { queryByRole } = renderChrome(model)
  expect(queryByRole('menu')).toBeNull()
})
