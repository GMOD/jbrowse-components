import { useState } from 'react'

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import {
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes/index.ts'
import type { ToggleButtonProps } from '@mui/material'

function shorten(str: string, len: number) {
  return str.length > len ? `${str.slice(0, len)}…` : str
}

function ToggleButtonWithTooltip(props: ToggleButtonProps) {
  const { title, children, ...other } = props
  return (
    <Tooltip title={title || ''}>
      <ToggleButton {...other}>{children}</ToggleButton>
    </Tooltip>
  )
}

const isAdminMode = () =>
  new URLSearchParams(window.location.search).get('adminKey') !== null

function HiddenAccountsMenu({
  anchorEl,
  hiddenAccountIds,
  accountMap,
  onClose,
  onSelect,
}: {
  anchorEl: HTMLElement | null
  hiddenAccountIds: string[]
  accountMap: Record<string, BaseInternetAccountModel>
  onClose: () => void
  onSelect: (id: string) => void
}) {
  if (!anchorEl) {
    return null
  }
  return (
    <Menu
      open
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      onClose={onClose}
    >
      {hiddenAccountIds.map(id => (
        <MenuItem
          key={id}
          value={id}
          onClick={() => {
            onSelect(id)
          }}
        >
          {accountMap[id]!.name}
        </MenuItem>
      ))}
    </Menu>
  )
}

export default function SourceTypeSelector({
  value,
  shownAccountIds,
  hiddenAccountIds,
  accountMap,
  onChange,
  onHiddenAccountSelect,
}: {
  value: string
  shownAccountIds: string[]
  hiddenAccountIds: string[]
  accountMap: Record<string, BaseInternetAccountModel>
  onChange: (event: React.MouseEvent, newValue: string | null) => void
  onHiddenAccountSelect: (id: string) => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <>
      <ToggleButtonGroup
        value={value}
        exclusive
        size="small"
        onChange={onChange}
        aria-label="file, url, or account picker"
      >
        {isAdminMode() ? null : (
          <ToggleButton size="small" value="file" aria-label="local file">
            File
          </ToggleButton>
        )}
        <ToggleButton size="small" value="url" aria-label="url">
          URL
        </ToggleButton>
        {shownAccountIds.map(id => {
          const account = accountMap[id]!
          const { toggleContents, name: accountName } = account
          const label =
            typeof toggleContents === 'string'
              ? shorten(toggleContents, 5)
              : toggleContents || shorten(accountName, 5)
          return (
            <ToggleButtonWithTooltip key={id} value={id} title={accountName}>
              {label}
            </ToggleButtonWithTooltip>
          )
        })}
        {hiddenAccountIds.length > 0 ? (
          <ToggleButton
            value="more"
            onClick={event => {
              setAnchorEl(event.target as HTMLElement)
            }}
            selected={false}
          >
            More
            <ArrowDropDownIcon />
          </ToggleButton>
        ) : null}
      </ToggleButtonGroup>
      <HiddenAccountsMenu
        anchorEl={anchorEl}
        hiddenAccountIds={hiddenAccountIds}
        accountMap={accountMap}
        onClose={() => {
          setAnchorEl(null)
        }}
        onSelect={id => {
          onHiddenAccountSelect(id)
          setAnchorEl(null)
        }}
      />
    </>
  )
}
