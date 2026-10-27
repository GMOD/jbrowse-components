import { useDeferredValue, useState } from 'react'

import {
  getConfigurationSchemaMetadata,
  refusingUndeclaredKeys,
} from '@jbrowse/core/configuration'
import {
  ExternalLink,
  MonospaceTextField,
  SubmitDialog,
} from '@jbrowse/core/ui'
import { isObject } from '@jbrowse/core/util'
import {
  applySnapshot,
  getEnv,
  getSnapshot,
  getType,
} from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// the schema's page in the config reference, which lists every setting
function referenceUrl(target: AnyConfigurationModel) {
  const name = getConfigurationSchemaMetadata(target)?.name
  return name
    ? `https://jbrowse.org/jb2/docs/config/${name.toLowerCase()}/`
    : 'https://jbrowse.org/jb2/docs/config_guide/'
}

// Reads the text as the config would load it, refusing what a write refuses:
// a key the schema does not declare, a value a slot does not take, or a new
// trackId, which would make it another track.
function readDraft(target: AnyConfigurationModel, text: string) {
  try {
    const snapshot: unknown = JSON.parse(text)
    if (!isObject(snapshot) || Array.isArray(snapshot)) {
      throw new Error('The settings are one JSON object')
    }
    const { trackId } = getSnapshot<Record<string, unknown>>(target)
    if (snapshot.trackId !== trackId) {
      throw new Error(`trackId must stay ${JSON.stringify(trackId)}`)
    }
    refusingUndeclaredKeys(() =>
      getType(target).create(snapshot, getEnv(target)),
    )
    return { snapshot }
  } catch (error) {
    return { error }
  }
}

const SettingsJsonDialog = observer(function SettingsJsonDialog({
  target,
  handleClose,
}: {
  target: AnyConfigurationModel
  handleClose: () => void
}) {
  const [text, setText] = useState(() =>
    JSON.stringify(getSnapshot(target), null, 2),
  )
  // a draft is checked by building a whole config, which typing outpaces
  const checked = useDeferredValue(text)
  const { snapshot, error } = readDraft(target, checked)
  return (
    <SubmitDialog
      open
      maxWidth="md"
      fullWidth
      title="Edit settings as JSON"
      submitText="Apply"
      submitDisabled={!snapshot || checked !== text}
      onCancel={handleClose}
      onSubmit={() => {
        if (snapshot) {
          applySnapshot(target, snapshot)
          handleClose()
        }
      }}
    >
      <ExternalLink href={referenceUrl(target)}>Config reference</ExternalLink>
      <MonospaceTextField
        value={text}
        error={error}
        helperText="The config as config.json would write it. A setting deleted from it returns to its default."
        inputTestId="settingsJson"
        onChange={setText}
      />
    </SubmitDialog>
  )
})

export default SettingsJsonDialog
