import { useLocalStorage } from '@jbrowse/core/util/hooks'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

// Both tabs share the one localStorage flag, so opening advanced options in one
// leaves them open in the other.
function useShowAdvanced() {
  return useLocalStorage('cluster-showAdvanced', false)
}

/**
 * The show/hide toggle and its contents. Renders nothing at all when there is
 * nothing to show, which is why the toggle lives here rather than in each tab:
 * the variants auto tab has no advanced controls and used to show a toggle that
 * revealed an empty box.
 */
const ClusterAdvancedOptions = observer(function ClusterAdvancedOptions({
  children,
}: {
  children?: React.ReactNode
}) {
  const [showAdvanced, setShowAdvanced] = useShowAdvanced()
  return children ? (
    <div>
      <Button
        variant="contained"
        onClick={() => {
          setShowAdvanced(!showAdvanced)
        }}
      >
        {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
      </Button>
      {showAdvanced ? (
        <div>
          <Typography variant="h6">Advanced options</Typography>
          {children}
        </div>
      ) : null}
    </div>
  ) : null
})

export default ClusterAdvancedOptions
