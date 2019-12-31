export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes: MobxPropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState, useRef } = React

  const Icon = jbrequire('@material-ui/core/Icon')
  const Menu = jbrequire('@material-ui/core/Menu')
  const MenuItem = jbrequire('@material-ui/core/MenuItem')
  const ListItemIcon = jbrequire('@material-ui/core/ListItemIcon')
  const ListItemText = jbrequire('@material-ui/core/ListItemText')

  const ColumnMenu = observer(
    ({ viewModel, spreadsheetModel, currentColumnMenu, setColumnMenu }) => {
      const columnMenuClose = () => {
        setDataTypeMenuOpen(false)
        setColumnMenu(null)
      }

      const columnNumber = currentColumnMenu && currentColumnMenu.colNumber

      const sortMenuClick = descending => {
        columnMenuClose()
        spreadsheetModel.setSortColumns([
          {
            columnNumber,
            descending,
          },
        ])
      }

      const filterMenuClick = () => {
        columnMenuClose()
        viewModel.filterControls.addBlankColumnFilter(columnNumber)
      }

      const [dataTypeMenuOpen, setDataTypeMenuOpen] = useState(false)
      const dataTypeMenuItemRef = useRef(null)

      const { dataTypeChoices } = spreadsheetModel

      const dataType =
        currentColumnMenu && spreadsheetModel.columns[columnNumber].dataType
      const dataTypeName = (dataType && dataType.type) || ''
      const dataTypeDisplayName =
        (currentColumnMenu &&
          spreadsheetModel.columns[columnNumber].dataType.displayName) ||
        ''

      const isSorting = Boolean(
        spreadsheetModel.sortColumns.length &&
          currentColumnMenu &&
          spreadsheetModel.sortColumns.find(
            col => col.columnNumber === currentColumnMenu.colNumber,
          ),
      )
      function stopSortingClick() {
        columnMenuClose()
        spreadsheetModel.setSortColumns([])
      }

      return (
        <>
          {/* top-level column menu =========================  */}
          <Menu
            anchorEl={currentColumnMenu && currentColumnMenu.anchorEl}
            keepMounted
            open={Boolean(currentColumnMenu)}
            onClose={columnMenuClose}
            elevation={8}
            getContentAnchorEl={null}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            {!isSorting ? null : (
              <MenuItem onClick={stopSortingClick}>
                <ListItemIcon>
                  <Icon fontSize="small">clear</Icon>
                </ListItemIcon>
                <ListItemText primary="Stop sorting" />
              </MenuItem>
            )}
            <MenuItem onClick={sortMenuClick.bind(null, false)}>
              <ListItemIcon>
                <Icon style={{ transform: 'scale(1,-1)' }} fontSize="small">
                  sort
                </Icon>
              </ListItemIcon>
              <ListItemText primary="Sort ascending" />
            </MenuItem>
            <MenuItem onClick={sortMenuClick.bind(null, true)}>
              <ListItemIcon>
                <Icon fontSize="small">sort</Icon>
              </ListItemIcon>
              <ListItemText primary="Sort descending" />
            </MenuItem>
            <MenuItem
              ref={dataTypeMenuItemRef}
              onClick={() => {
                setDataTypeMenuOpen(true)
              }}
            >
              <ListItemIcon>
                <Icon fontSize="small">perm_data_setting</Icon>
              </ListItemIcon>
              <ListItemText primary={`Type: ${dataTypeDisplayName}`} />
              <ListItemIcon>
                <Icon fontSize="small">arrow_right</Icon>
              </ListItemIcon>
            </MenuItem>
            {/* don't display the filter item if this data type doesn't have filtering implemented */
            !(dataType && dataType.hasFilter) ? null : (
              <MenuItem onClick={filterMenuClick.bind(null, true)}>
                <ListItemIcon>
                  <Icon fontSize="small">filter_list</Icon>
                </ListItemIcon>
                <ListItemText primary="Filter on this" />
              </MenuItem>
            )}
          </Menu>

          {/* data type menu =========================  */}
          <Menu
            anchorEl={
              currentColumnMenu &&
              dataTypeMenuItemRef &&
              dataTypeMenuItemRef.current
            }
            open={Boolean(currentColumnMenu && dataTypeMenuOpen)}
            onClose={columnMenuClose}
            elevation={10}
            getContentAnchorEl={null}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            {dataTypeChoices.map(({ typeName, displayName }) => {
              return (
                <MenuItem
                  key={typeName}
                  onClick={() => {
                    spreadsheetModel.setColumnType(columnNumber, typeName)
                    columnMenuClose()
                  }}
                >
                  <ListItemIcon>
                    <Icon fontSize="small">
                      {dataTypeName === typeName ? 'check' : 'blank'}
                    </Icon>
                  </ListItemIcon>
                  <ListItemText primary={displayName || typeName} />
                </MenuItem>
              )
            })}
          </Menu>
        </>
      )
    },
  )
  return ColumnMenu
}
