import { useRef, useState } from 'react'

import ArrowDropDown from '@mui/icons-material/ArrowDropDown'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'
import CascadingMenu from './CascadingMenu.tsx'
import { alpha } from './palette.ts'

import type { MenuItemsGetter } from './CascadingMenu.tsx'
import type { MenuItemClickHandler } from './MenuTypes.ts'

const useStyles = makeStyles()(theme => ({
  button: {
    '&:hover': {
      backgroundColor: alpha(
        theme.palette.primary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
}))

interface BarMenu {
  label: string
  menuItems: MenuItemsGetter
}

function hasRows({ menuItems }: BarMenu) {
  return (Array.isArray(menuItems) ? menuItems : menuItems()).length > 0
}

/**
 * An app bar's row of top-level menus. One menu is open at a time, and while
 * one is, pointing at another button or pressing ArrowLeft/ArrowRight moves to
 * that menu, as a desktop menu bar does.
 */
const MenuBar = observer(function MenuBar({
  menus,
  onMenuItemClick,
}: {
  menus: BarMenu[]
  onMenuItemClick?: (callback: MenuItemClickHandler) => void
}) {
  const { classes } = useStyles()
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const [open, setOpen] = useState<{
    label: string
    anchorEl: HTMLButtonElement
  }>()
  const openMenu = menus.find(menu => menu.label === open?.label)

  const show = (menu: BarMenu) => {
    const anchorEl = buttons.current.get(menu.label)
    if (anchorEl && hasRows(menu)) {
      setOpen({ label: menu.label, anchorEl })
    }
  }

  return (
    <>
      {menus.map(menu => (
        <Button
          key={menu.label}
          ref={el => {
            if (el) {
              buttons.current.set(menu.label, el)
            } else {
              buttons.current.delete(menu.label)
            }
          }}
          color="inherit"
          className={classes.button}
          aria-haspopup="menu"
          aria-expanded={menu === openMenu}
          onClick={() => {
            show(menu)
          }}
        >
          {menu.label}
          <ArrowDropDown />
        </Button>
      ))}
      {open && openMenu ? (
        <CascadingMenu
          key={open.label}
          open
          anchorEl={open.anchorEl}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          menuItems={openMenu.menuItems}
          onMenuItemClick={onMenuItemClick}
          onClose={() => {
            setOpen(undefined)
          }}
          onBackdropMouseMove={({ clientX, clientY }) => {
            const pointed = menus.find(menu => {
              const rect = buttons.current
                .get(menu.label)
                ?.getBoundingClientRect()
              return (
                rect &&
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom
              )
            })
            if (pointed && pointed !== openMenu) {
              show(pointed)
            }
          }}
          onNavigateSibling={step => {
            const from = menus.indexOf(openMenu)
            const after = [...menus.slice(from + 1), ...menus.slice(0, from)]
            const sibling = (step === 1 ? after : after.toReversed()).find(
              hasRows,
            )
            if (sibling) {
              show(sibling)
            }
          }}
        />
      ) : null}
    </>
  )
})

export default MenuBar
