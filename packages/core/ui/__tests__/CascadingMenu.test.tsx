import { fireEvent, render, screen } from '@testing-library/react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

function TestComponent() {
  return (
    <CascadingMenuButton
      data-testid="menu-button"
      menuItems={[
        { label: 'Item 1', onClick: () => console.log('Item 1 clicked') },
        { label: 'Item 2', onClick: () => console.log('Item 2 clicked') },
        {
          label: 'Submenu',
          type: 'subMenu' as const,
          subMenu: [
            { label: 'Sub Item 1', onClick: () => console.log('Sub 1') },
            { label: 'Sub Item 2', onClick: () => console.log('Sub 2') },
          ],
        },
      ]}
    >
      <span>Open Menu</span>
    </CascadingMenuButton>
  )
}

// Test with function-based menuItems (like ViewMenu uses)
function TestComponentWithFunction() {
  return (
    <CascadingMenuButton
      data-testid="menu-button-fn"
      menuItems={() => [
        { label: 'Fn Item 1', onClick: () => console.log('Fn Item 1') },
        { label: 'Fn Item 2', onClick: () => console.log('Fn Item 2') },
        {
          label: 'Fn Submenu',
          type: 'subMenu' as const,
          subMenu: [
            { label: 'Fn Sub 1', onClick: () => console.log('Fn Sub 1') },
          ],
        },
      ]}
    >
      <span>Open Menu</span>
    </CascadingMenuButton>
  )
}

describe('CascadingMenu', () => {
  it('should render the button', () => {
    render(<TestComponent />)
    expect(screen.getByTestId('menu-button')).toBeTruthy()
  })

  it('should open menu when clicked', async () => {
    render(<TestComponent />)

    const button = screen.getByTestId('menu-button')
    fireEvent.click(button)

    const item1 = await screen.findByText('Item 1', {}, { timeout: 5000 })
    expect(item1).toBeTruthy()
  })

  it('should show submenu on hover', async () => {
    render(<TestComponent />)

    fireEvent.click(screen.getByTestId('menu-button'))

    const submenu = await screen.findByText('Submenu', {}, { timeout: 5000 })
    fireEvent.mouseOver(submenu)

    const subItem = await screen.findByText('Sub Item 1', {}, { timeout: 5000 })
    expect(subItem).toBeTruthy()
  })

  it('should work with function-based menuItems', async () => {
    render(<TestComponentWithFunction />)

    fireEvent.click(screen.getByTestId('menu-button-fn'))

    const item1 = await screen.findByText('Fn Item 1', {}, { timeout: 5000 })
    expect(item1).toBeTruthy()
  })
})
