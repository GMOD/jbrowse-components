import React from 'react'
import { observer } from 'mobx-react'
import { iterMap } from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'
import { MenuItem } from '@jbrowse/core/ui/Menu'
import { SvgIcon } from '@mui/material'
import { SpreadsheetModel } from '../models/Spreadsheet'
import { SpreadsheetViewModel } from '../models/SpreadsheetView'

// icons
import CheckIcon from '@mui/icons-material/Check'
import FilterListIcon from '@mui/icons-material/FilterList'
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting'
import SortIcon from '@mui/icons-material/Sort'

const ColumnMenu = observer(
  ({
    viewModel,
    spreadsheetModel,
    currentColumnMenu,
    setColumnMenu,
  }: {
    spreadsheetModel: SpreadsheetModel
    viewModel: SpreadsheetViewModel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentColumnMenu: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setColumnMenu: (arg: any) => void
  }) => {
    const columnMenuClose = () => {
      setColumnMenu(null)
    }

    const columnNumber = currentColumnMenu && currentColumnMenu.colNumber

    const sortMenuClick = (descending: boolean) => {
      spreadsheetModel.setSortColumns([
        {
          columnNumber,
          descending,
        },
      ])
    }

    const filterMenuClick = () => {
      viewModel.filterControls.addBlankColumnFilter(columnNumber)
    }

    const { dataTypeChoices } = spreadsheetModel

    // make a Map of categoryName => [entry...]
    const dataTypeTopLevelMenu = new Map()
    dataTypeChoices.forEach(dataTypeRecord => {
      const { displayName, categoryName } = dataTypeRecord
      if (categoryName) {
        if (!dataTypeTopLevelMenu.has(categoryName)) {
          dataTypeTopLevelMenu.set(categoryName, {
            isCategory: true,
            subMenuItems: [],
          })
        }
        dataTypeTopLevelMenu.get(categoryName).subMenuItems.push(dataTypeRecord)
      } else {
        dataTypeTopLevelMenu.set(displayName, dataTypeRecord)
      }
    })

    const dataType =
      currentColumnMenu && spreadsheetModel.columns[columnNumber].dataType
    const dataTypeName = (dataType && dataType.type) || ''
    const dataTypeDisplayName =
      (currentColumnMenu &&
        spreadsheetModel.columns[columnNumber].dataType.displayName) ||
      ''

    const isSortingAscending = Boolean(
      spreadsheetModel.sortColumns.length &&
        currentColumnMenu &&
        spreadsheetModel.sortColumns.find(
          col =>
            col.columnNumber === currentColumnMenu.colNumber && !col.descending,
        ),
    )
    const isSortingDescending = Boolean(
      spreadsheetModel.sortColumns.length &&
        currentColumnMenu &&
        spreadsheetModel.sortColumns.find(
          col =>
            col.columnNumber === currentColumnMenu.colNumber && col.descending,
        ),
    )
    function stopSortingClick() {
      columnMenuClose()
      spreadsheetModel.setSortColumns([])
    }

    const menuItems = [
      // top-level column menu
      {
        label: 'Sort ascending',
        icon: SortIcon,
        type: 'radio',
        checked: isSortingAscending,
        onClick: isSortingAscending
          ? stopSortingClick
          : sortMenuClick.bind(null, false),
      },
      {
        label: 'Sort descending',
        icon: SortIcon,
        type: 'radio',
        checked: isSortingDescending,
        onClick: isSortingDescending
          ? stopSortingClick
          : sortMenuClick.bind(null, true),
      },
      // data type menu
      {
        label: `Type: ${dataTypeDisplayName}`,
        icon: PermDataSettingIcon,
        subMenu: iterMap(
          dataTypeTopLevelMenu.entries(),
          ([displayName, record]) => {
            const { subMenuItems, typeName } = record
            if (typeName) {
              const menuEntry = {
                label: displayName || typeName,
                icon: undefined as typeof SvgIcon | undefined,
                onClick: () => {
                  spreadsheetModel.setColumnType(columnNumber, typeName)
                },
              }
              if (dataTypeName === typeName) {
                menuEntry.icon = CheckIcon
              }
              return menuEntry
            }
            if (subMenuItems) {
              return {
                label: displayName,
                icon: subMenuItems.find(
                  (i: { typeName: string }) => i.typeName === dataTypeName,
                )
                  ? CheckIcon
                  : undefined,
                subMenu: subMenuItems.map(
                  ({
                    typeName: subTypeName,
                    displayName: subDisplayName,
                  }: {
                    typeName: string
                    displayName: string
                  }) => ({
                    label: subDisplayName,
                    icon: subTypeName === dataTypeName ? CheckIcon : undefined,
                    onClick: () => {
                      spreadsheetModel.setColumnType(columnNumber, subTypeName)
                    },
                  }),
                ),
              }
            }
            return null
          },
        ).filter(Boolean),
      },
    ] as MenuItem[]

    // don't display the filter item if this data type doesn't have filtering
    // implemented
    if (dataType && dataType.hasFilter) {
      menuItems.push({
        label: 'Create filter',
        icon: FilterListIcon,
        onClick: filterMenuClick.bind(null, true),
      })
    }

    return (
      <Menu
        anchorEl={currentColumnMenu && currentColumnMenu.anchorEl}
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
  },
)

export default ColumnMenu
