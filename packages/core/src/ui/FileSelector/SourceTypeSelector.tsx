import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'

import CascadingMenuButton from '../CascadingMenuButton.tsx'
import { getAccountLabel, isAdminMode } from './util.ts'

import type { BaseInternetAccountModel } from '../../pluggableElementTypes/index.ts'

function AccountToggleButton({
  account,
}: {
  account: BaseInternetAccountModel
}) {
  return (
    <Tooltip title={account.name}>
      <ToggleButton value={account.internetAccountId}>
        {getAccountLabel(account)}
      </ToggleButton>
    </Tooltip>
  )
}

function MoreButton({
  onClick,
  disabled,
  children,
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <ToggleButton
      value="more"
      selected={false}
      disabled={disabled}
      onClick={e => {
        onClick(e as React.MouseEvent<HTMLButtonElement>)
      }}
    >
      {children}
    </ToggleButton>
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
  const shownAccounts = shownAccountIds.map(id => accountMap[id]!)
  const hiddenAccounts = hiddenAccountIds.map(id => accountMap[id]!)

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      onChange={onChange}
      aria-label="file, url, or account picker"
    >
      {!isAdminMode() && (
        <ToggleButton value="file" aria-label="local file">
          File
        </ToggleButton>
      )}
      <ToggleButton value="url" aria-label="url">
        URL
      </ToggleButton>
      {shownAccounts.map(account => (
        <AccountToggleButton
          key={account.internetAccountId}
          account={account}
        />
      ))}
      {hiddenAccounts.length > 0 && (
        <CascadingMenuButton
          menuItems={hiddenAccounts.map(account => ({
            label: account.name,
            onClick: () => {
              onHiddenAccountSelect(account.internetAccountId)
            },
          }))}
          ButtonComponent={MoreButton}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          More
          <ArrowDropDownIcon />
        </CascadingMenuButton>
      )}
    </ToggleButtonGroup>
  )
}
