import { Alert } from '@mui/material'

/**
 * Shared alert used by export/share/delete dialogs to explain whether
 * all bookmarks or only selected ones will be affected.
 */
export default function BookmarkSelectionAlert({
  all,
  verb,
  severity = 'info',
}: {
  all: boolean
  verb: string
  severity?: 'info' | 'warning'
}) {
  return (
    <Alert severity={severity}>
      {all ? (
        <>
          <span>All bookmarks will be {verb}.</span>
          <br />
          <span>
            Use the checkboxes to select individual bookmarks to {verb}.
          </span>
        </>
      ) : (
        `Only selected bookmarks will be ${verb}.`
      )}
    </Alert>
  )
}
