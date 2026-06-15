import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import CascadingMenuButton from '../CascadingMenuButton.tsx'

import type { MenuItem } from '../MenuTypes.ts'

jest.spyOn(console, 'warn').mockImplementation(() => {})

const menuItems: MenuItem[] = [
  { label: 'Item 1', onClick: () => {} },
  { label: 'Item 2', onClick: () => {} },
  {
    label: 'Submenu',
    type: 'subMenu' as const,
    subMenu: [
      { label: 'Sub Item 1', onClick: () => {} },
      { label: 'Sub Item 2', onClick: () => {} },
    ],
  },
]

async function setup(items: MenuItem[] = menuItems) {
  const user = userEvent.setup()
  render(
    <CascadingMenuButton data-testid="menu-button" menuItems={items}>
      <span>Open Menu</span>
    </CascadingMenuButton>,
  )
  return user
}

describe('CascadingMenu', () => {
  it('should open menu via keyboard', async () => {
    const user = await setup()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Item 1')).toBeTruthy()
  })

  it('should open menu when clicked', async () => {
    const user = await setup()
    await user.click(screen.getByTestId('menu-button'))
    expect(await screen.findByText('Item 1')).toBeTruthy()
  })

  it('should show submenu on click', async () => {
    const user = await setup()
    await user.click(screen.getByTestId('menu-button'))
    await user.click(await screen.findByText('Submenu'))
    expect(await screen.findByText('Sub Item 1')).toBeTruthy()
  })

  it('should show submenu on hover', async () => {
    const user = await setup()
    await user.click(screen.getByTestId('menu-button'))
    await user.hover(await screen.findByText('Submenu'))
    expect(await screen.findByText('Sub Item 1')).toBeTruthy()
  })

  it('should open submenu on ArrowRight key', async () => {
    const user = await setup()
    await user.click(screen.getByTestId('menu-button'))
    await user.click(await screen.findByText('Submenu'))
    await user.keyboard('{ArrowRight}')
    expect(await screen.findByText('Sub Item 1')).toBeTruthy()
  })

  it('should close submenu on ArrowLeft key', async () => {
    const user = await setup()
    await user.click(screen.getByTestId('menu-button'))
    await user.click(await screen.findByText('Submenu'))
    const subItem = await screen.findByRole('menuitem', { name: 'Sub Item 1' })
    subItem.focus()
    await user.keyboard('{ArrowLeft}')
    await waitFor(() => {
      expect(screen.queryByText('Sub Item 1')).toBeNull()
    })
  })

  it('should work with function-based menuItems', async () => {
    const user = userEvent.setup()
    render(
      <CascadingMenuButton
        data-testid="menu-button"
        menuItems={() => menuItems}
      >
        <span>Open Menu</span>
      </CascadingMenuButton>,
    )
    await user.click(screen.getByTestId('menu-button'))
    expect(await screen.findByText('Item 1')).toBeTruthy()
  })

  it('should not open an empty menu for a getter that yields no items', async () => {
    const user = userEvent.setup()
    render(
      <CascadingMenuButton data-testid="menu-button" menuItems={() => []}>
        <span>Open Menu</span>
      </CascadingMenuButton>,
    )
    const button = screen.getByTestId('menu-button')
    expect(button).not.toBeDisabled()
    await user.click(button)
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull()
    })
  })

  it('should disable the button for an empty array of items', async () => {
    await setup([])
    expect(screen.getByTestId('menu-button')).toBeDisabled()
  })

  it('should render a disabled submenu that cannot be opened', async () => {
    // pointerEventsCheck off so we can attempt to hover the disabled item
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(
      <CascadingMenuButton
        data-testid="menu-button"
        menuItems={[
          {
            label: 'Submenu',
            type: 'subMenu',
            disabled: true,
            subMenu: [{ label: 'Sub Item 1', onClick: () => {} }],
          },
        ]}
      >
        <span>Open Menu</span>
      </CascadingMenuButton>,
    )
    await user.click(screen.getByTestId('menu-button'))
    const submenu = await screen.findByText('Submenu')
    expect(submenu.closest('li')).toHaveClass('Mui-disabled')
    await user.hover(submenu)
    await waitFor(() => {
      expect(screen.queryByText('Sub Item 1')).toBeNull()
    })
  })

  it('should show a tooltip explaining why a disabled item is disabled', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(
      <CascadingMenuButton
        data-testid="menu-button"
        menuItems={[
          {
            label: 'Disabled item',
            disabled: true,
            disabledHelpText: 'Needs a configured adapter',
            onClick: () => {},
          },
        ]}
      >
        <span>Open Menu</span>
      </CascadingMenuButton>,
    )
    await user.click(screen.getByTestId('menu-button'))
    await user.hover(await screen.findByText('Disabled item'))
    expect(await screen.findByText('Needs a configured adapter')).toBeTruthy()
  })
})
