import { fireEvent, render, screen } from '@testing-library/react'

import CascadingMenuButton from '../CascadingMenuButton'

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

describe('CascadingMenu', () => {
  it('should open menu when clicked', async () => {
    render(
      <CascadingMenuButton data-testid="menu-button" menuItems={menuItems}>
        <span>Open Menu</span>
      </CascadingMenuButton>,
    )
    fireEvent.click(screen.getByTestId('menu-button'))
    expect(await screen.findByText('Item 1')).toBeTruthy()
  })

  it('should show submenu on click', async () => {
    render(
      <CascadingMenuButton data-testid="menu-button" menuItems={menuItems}>
        <span>Open Menu</span>
      </CascadingMenuButton>,
    )
    fireEvent.click(screen.getByTestId('menu-button'))
    fireEvent.click(await screen.findByText('Submenu'))
    expect(await screen.findByText('Sub Item 1')).toBeTruthy()
  })

  it('should show submenu on hover', async () => {
    render(
      <CascadingMenuButton data-testid="menu-button" menuItems={menuItems}>
        <span>Open Menu</span>
      </CascadingMenuButton>,
    )
    fireEvent.click(screen.getByTestId('menu-button'))
    fireEvent.mouseOver(await screen.findByText('Submenu'))
    expect(await screen.findByText('Sub Item 1')).toBeTruthy()
  })

  it('should work with function-based menuItems', async () => {
    render(
      <CascadingMenuButton
        data-testid="menu-button"
        menuItems={() => menuItems}
      >
        <span>Open Menu</span>
      </CascadingMenuButton>,
    )
    fireEvent.click(screen.getByTestId('menu-button'))
    expect(await screen.findByText('Item 1')).toBeTruthy()
  })
})
