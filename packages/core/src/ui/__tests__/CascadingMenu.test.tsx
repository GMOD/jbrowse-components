import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import CascadingMenuButton from '../CascadingMenuButton.tsx'

jest.spyOn(console, 'warn').mockImplementation(() => {})

const menuItems = [
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

async function setup(items = menuItems) {
  const user = userEvent.setup()
  const menuItemsArg = Array.isArray(items) ? items : items
  render(
    <CascadingMenuButton
      data-testid="menu-button"
      menuItems={menuItemsArg}
    >
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
})
