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
import { deepEqual } from '@jbrowse/core/util/deepEqual'
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

type Snapshot = Record<string, unknown>

// a display entry a track writes for itself when its config names none: its
// type and the id the track derives from it
function isStubDisplay(display: unknown, trackId: unknown) {
  if (!isObject(display)) {
    return false
  }
  const { type, displayId, ...rest } = display
  return Object.keys(rest).length === 0 && displayId === `${trackId}-${type}`
}

function withDisplays(snapshot: Snapshot, displays: unknown[]) {
  const { displays: _all, ...rest } = snapshot
  return displays.length ? { ...rest, displays } : rest
}

// The snapshot without the display entries a track fills in by itself, where
// leaving them out loads the same config: the declared order picks the
// default display, so the stubs leading it may have to stay.
function printedSnapshot(target: AnyConfigurationModel): Snapshot {
  const snapshot = getSnapshot<Snapshot>(target)
  const { displays, trackId } = snapshot
  if (!Array.isArray(displays)) {
    return snapshot
  }
  let last = displays.length
  while (last > 0 && isStubDisplay(displays[last - 1], trackId)) {
    last--
  }
  const prefixes = Array.from({ length: displays.length - last }, (_, i) =>
    displays.slice(0, last + i),
  )
  return (
    [displays.filter(d => !isStubDisplay(d, trackId)), ...prefixes]
      .map(list => withDisplays(snapshot, list))
      .find(candidate => {
        try {
          return deepEqual(
            getSnapshot(getType(target).create(candidate, getEnv(target))),
            snapshot,
          )
        } catch {
          return false
        }
      }) ?? snapshot
  )
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
    JSON.stringify(printedSnapshot(target), null, 2),
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
        fullWidth
        value={text}
        error={error}
        helperText="The config as config.json would write it. A setting deleted from it returns to its default, and a display it leaves out takes the track type's defaults."
        inputTestId="settingsJson"
        onChange={setText}
      />
    </SubmitDialog>
  )
})

export default SettingsJsonDialog
