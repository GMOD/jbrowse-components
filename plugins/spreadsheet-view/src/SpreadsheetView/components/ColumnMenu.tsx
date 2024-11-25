import React from 'react'
import { Menu } from '@jbrowse/core/ui'
import { iterMap } from '@jbrowse/core/util'

// icons
import CheckIcon from '@mui/icons-material/Check'
import FilterListIcon from '@mui/icons-material/FilterList'
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting'
import SortIcon from '@mui/icons-material/Sort'
import { observer } from 'mobx-react'
import type { SpreadsheetModel } from '../models/Spreadsheet'
import type { SpreadsheetViewModel } from '../models/SpreadsheetView'
import type { MenuItem } from '@jbrowse/core/ui/Menu'

const ColumnMenu = observer(function ({
  viewModel,
  spreadsheetModel,
  currentColumnMenu,
  setColumnMenu,
}: {
  spreadsheetModel: SpreadsheetModel
  viewModel: SpreadsheetViewModel
  currentColumnMenu?: { colNumber: number; anchorEl: HTMLElement }
  setColumnMenu: (arg?: { anchorEl: HTMLElement; colNumber: number }) => void
}) {
  const columnMenuClose = () => {
    setColumnMenu(undefined)
  }
  const columnNumber = currentColumnMenu?.colNumber || 0
  const sortMenuClick = (descending: boolean) => {
    spreadsheetModel.setSortColumns([
      {
        columnNumber,
        descending,
      },
    ])
  }

  const { dataTypeChoices } = spreadsheetModel

  // make a Map of categoryName => [entry...]
  type Record = (typeof dataTypeChoices)[0]
  interface RecordGroup {
    isCategory: boolean
    subMenuItems: Record[]
  }
  const dataTypeTopLevelMenu = new Map<string, Record | RecordGroup>()
  dataTypeChoices.forEach(dataTypeRecord => {
    const { displayName, categoryName } = dataTypeRecord
    if (categoryName) {
      let entry = dataTypeTopLevelMenu.get(categoryName) as
        | RecordGroup
        | undefined
      if (!entry) {
        entry = {
          isCategory: true,
          subMenuItems: [],
        }
        dataTypeTopLevelMenu.set(categoryName, entry)
      }
      entry.subMenuItems.push(dataTypeRecord)
    } else {
      dataTypeTopLevelMenu.set(displayName, dataTypeRecord)
    }
  })

  const { columns, sortColumns } = spreadsheetModel
  const dataType = currentColumnMenu && columns[columnNumber]!.dataType
  const dataTypeName = dataType?.type || ''
  const dataTypeDisplayName =
    (currentColumnMenu && columns[columnNumber]!.dataType.displayName) || ''

  const isSortingAscending =
    !!currentColumnMenu &&
    sortColumns.some(
      c => c.columnNumber === currentColumnMenu.colNumber && !c.descending,
    )
  const isSortingDescending =
    !!currentColumnMenu &&
    sortColumns.some(
      c => c.columnNumber === currentColumnMenu.colNumber && c.descending,
    )

  const menuItems = [
    // top-level column menu
    {
      label: 'Sort ascending',
      icon: SortIcon,
      type: 'radio',
      checked: isSortingAscending,
      onClick: () => {
        sortMenuClick(false)
      },
    },
    {
      label: 'Sort descending',
      icon: SortIcon,
      type: 'radio',
      checked: isSortingDescending,
      onClick: () => {
        sortMenuClick(true)
      },
    },
    {
      label: 'No sort',
      icon: SortIcon,
      type: 'radio',
      checked: !isSortingDescending && !isSortingAscending,
      onClick: () => {
        spreadsheetModel.setSortColumns([])
      },
    },
    // data type menu
    {
      label: `Type: ${dataTypeDisplayName}`,
      icon: PermDataSettingIcon,
      subMenu: iterMap(
        dataTypeTopLevelMenu.entries(),
        ([displayName, record]) => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if ('typeName' in record && record.typeName) {
            const { typeName } = record
            return {
              label: displayName || typeName,
              icon: dataTypeName === typeName ? CheckIcon : undefined,
              onClick: () => {
                spreadsheetModel.setColumnType(columnNumber, typeName)
              },
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if ('subMenuItems' in record && record.subMenuItems) {
            const { subMenuItems } = record
            return {
              label: displayName,
              icon: subMenuItems.some(i => i.typeName === dataTypeName)
                ? CheckIcon
                : undefined,
              subMenu: subMenuItems.map(({ typeName, displayName }) => ({
                label: displayName,
                icon: typeName === dataTypeName ? CheckIcon : undefined,
                onClick: () => {
                  spreadsheetModel.setColumnType(columnNumber, typeName)
                },
              })),
            }
          }
          return null
        },
      ).filter(Boolean),
    },
  ] as MenuItem[]

  // don't display the filter item if this data type doesn't have filtering
  // implemented
  if (dataType?.hasFilter) {
    menuItems.push({
      label: 'Create filter',
      icon: FilterListIcon,
      onClick: () => {
        viewModel.filterControls.addBlankColumnFilter(columnNumber)
      },
    })
  }

  return (
    <Menu
      anchorEl={currentColumnMenu?.anchorEl}
      open={Boolean(currentColumnMenu)}
      onMenuItemClick={(_event, callback) => {
        callback()
        columnMenuClose()
      }}
      onClose={columnMenuClose}
      menuItems={menuItems}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
    />
  )
})

export default ColumnMenu
