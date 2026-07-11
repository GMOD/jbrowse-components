import '@testing-library/jest-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import CascadingMenuButton from './CascadingMenuButton.tsx'

import type { MenuItem } from './MenuTypes.ts'

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

describe('CascadingMenuButton', () => {
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

  it('should render a custom item inline', async () => {
    const user = await setup([
      {
        label: 'custom-row',
        type: 'custom',
        render: () => <div>custom content</div>,
      },
    ])
    await user.click(screen.getByTestId('menu-button'))
    expect(await screen.findByText('custom content')).toBeTruthy()
  })

  it('should not close the menu when interacting with a custom item', async () => {
    const onClick = jest.fn()
    const user = await setup([
      {
        label: 'custom-row',
        type: 'custom',
        render: () => (
          <button type="button" onClick={() => onClick()}>
            nudge
          </button>
        ),
      },
      { label: 'Item 1', onClick: () => {} },
    ])
    await user.click(screen.getByTestId('menu-button'))
    await user.click(await screen.findByText('nudge'))
    expect(onClick).toHaveBeenCalled()
    // the custom row is not a clickable MenuItem, so the menu stays open
    expect(screen.getByText('Item 1')).toBeTruthy()
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

  it('should order items by descending priority', async () => {
    const user = await setup([
      { label: 'Low', priority: -10, onClick: () => {} },
      { label: 'High', priority: 100, onClick: () => {} },
      { label: 'Default', onClick: () => {} },
    ])
    await user.click(screen.getByTestId('menu-button'))
    await screen.findByText('High')
    const labels = screen.getAllByRole('menuitem').map(el => el.textContent)
    expect(labels).toEqual(['High', 'Default', 'Low'])
  })

  it('should render an endAdornment on a row', async () => {
    const user = await setup([
      {
        label: 'Item 1',
        onClick: () => {},
        endAdornment: <span>adorn-badge</span>,
      },
    ])
    await user.click(screen.getByTestId('menu-button'))
    expect(await screen.findByText('adorn-badge')).toBeTruthy()
  })

  it('should mark the submenu row expanded state via aria', async () => {
    const user = await setup()
    await user.click(screen.getByTestId('menu-button'))
    const row = (await screen.findByText('Submenu')).closest('li')!
    expect(row).toHaveAttribute('aria-haspopup', 'menu')
    expect(row).toHaveAttribute('aria-expanded', 'false')
    await user.hover(within(row).getByText('Submenu'))
    await waitFor(() => {
      expect(row).toHaveAttribute('aria-expanded', 'true')
    })
  })

  it('should open a help dialog from a row with helpText', async () => {
    const user = await setup([
      { label: 'Item 1', helpText: 'the explanation', onClick: () => {} },
    ])
    await user.click(screen.getByTestId('menu-button'))
    const row = (await screen.findByText('Item 1')).closest('li')!
    await user.click(within(row).getByRole('button'))
    expect(await screen.findByText('the explanation')).toBeTruthy()
  })

  it('should show a checked decoration for a checked checkbox item', async () => {
    const user = await setup([
      { label: 'Toggle', type: 'checkbox', checked: true, onClick: () => {} },
    ])
    await user.click(screen.getByTestId('menu-button'))
    expect(await screen.findByTestId('CheckBoxIcon')).toBeTruthy()
  })

  it('should render a divider and a subHeader', async () => {
    const user = await setup([
      { type: 'subHeader', label: 'Section' },
      { type: 'divider' },
      { label: 'Item 1', onClick: () => {} },
    ])
    await user.click(screen.getByTestId('menu-button'))
    expect(await screen.findByText('Section')).toBeTruthy()
    expect(screen.getByRole('separator')).toBeTruthy()
  })
})
