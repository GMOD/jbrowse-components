import React from 'react'
import { observer } from 'mobx-react'
import { iterMap } from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'
import { MenuItem } from '@jbrowse/core/ui/Menu'
import { SpreadsheetModel } from '../models/Spreadsheet'
import { SpreadsheetViewModel } from '../models/SpreadsheetView'

// icons
import CheckIcon from '@mui/icons-material/Check'
import FilterListIcon from '@mui/icons-material/FilterList'
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting'
import SortIcon from '@mui/icons-material/Sort'

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
  const columnMenuClose = () => setColumnMenu(undefined)
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
      let entry = dataTypeTopLevelMenu.get(categoryName) as RecordGroup
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
  const dataType = currentColumnMenu && columns[columnNumber].dataType
  const dataTypeName = dataType?.type || ''
  const dataTypeDisplayName =
    (currentColumnMenu && columns[columnNumber].dataType.displayName) || ''

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
      checked: isSortingAscending,
      icon: SortIcon,
      label: 'Sort ascending',
      onClick: () => sortMenuClick(false),
      type: 'radio',
    },
    {
      checked: isSortingDescending,
      icon: SortIcon,
      label: 'Sort descending',
      onClick: () => sortMenuClick(true),
      type: 'radio',
    },
    {
      checked: !isSortingDescending && !isSortingAscending,
      icon: SortIcon,
      label: 'No sort',
      onClick: () => spreadsheetModel.setSortColumns([]),
      type: 'radio',
    },
    // data type menu
    {
      icon: PermDataSettingIcon,
      label: `Type: ${dataTypeDisplayName}`,
      subMenu: iterMap(
        dataTypeTopLevelMenu.entries(),
        ([displayName, record]) => {
          if ('typeName' in record && record.typeName) {
            const { typeName } = record
            return {
              icon: dataTypeName === typeName ? CheckIcon : undefined,
              label: displayName || typeName,
              onClick: () =>
                spreadsheetModel.setColumnType(columnNumber, typeName),
            }
          } else if ('subMenuItems' in record && record.subMenuItems) {
            const { subMenuItems } = record
            return {
              icon: subMenuItems.some(i => i.typeName === dataTypeName)
                ? CheckIcon
                : undefined,
              label: displayName,
              subMenu: subMenuItems.map(({ typeName, displayName }) => ({
                icon: typeName === dataTypeName ? CheckIcon : undefined,
                label: displayName,
                onClick: () =>
                  spreadsheetModel.setColumnType(columnNumber, typeName),
              })),
            }
          } else {
            return null
          }
        },
      ).filter(Boolean),
    },
  ] as MenuItem[]

  // don't display the filter item if this data type doesn't have filtering
  // implemented
  if (dataType?.hasFilter) {
    menuItems.push({
      icon: FilterListIcon,
      label: 'Create filter',
      onClick: () =>
        viewModel.filterControls.addBlankColumnFilter(columnNumber),
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
        horizontal: 'right',
        vertical: 'bottom',
      }}
    />
  )
})

export default ColumnMenu
