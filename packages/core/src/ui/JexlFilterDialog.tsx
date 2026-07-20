import { useState } from 'react'

import { observer } from 'mobx-react'

import { stringToJexlExpression } from '../util/jexlStrings.ts'
import ExternalLink from './ExternalLink.tsx'
import MonospaceTextField from './MonospaceTextField.tsx'
import SubmitDialog from './SubmitDialog.tsx'

import type { JexlInstance } from '../util/jexlStrings.ts'

// Non-blank, trimmed lines — the filter list excludes blank lines a user leaves
// in the textarea, and the same set is what gets validated.
function filterLines(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line)
}

// jexl compile error for the current text, or undefined when every line parses.
// Derived during render (compilation is cached on the instance, so no effect
// needed).
function jexlError(text: string, jexl: JexlInstance) {
  try {
    for (const line of filterLines(text)) {
      stringToJexlExpression(line, jexl)
    }
    return undefined
  } catch (e) {
    return e
  }
}

/**
 * Editor for a list of jexl feature filters (one per line). Shared by the
 * feature-track and multi-sample-variant displays — callers pass the current
 * filter list and receive the trimmed, non-blank lines on submit (empty-list
 * handling is the caller's policy, since clearing means different things to a
 * config-backed slot vs a plain field).
 */
const JexlFilterDialog = observer(function JexlFilterDialog({
  filters,
  setFilters,
  handleClose,
  jexl,
}: {
  filters?: string[]
  setFilters: (arg: string[]) => void
  handleClose: () => void
  jexl: JexlInstance
}) {
  const [data, setData] = useState((filters ?? []).join('\n'))
  const error = jexlError(data, jexl)

  return (
    <SubmitDialog
      maxWidth="xl"
      open
      title="Add track filters"
      submitDisabled={!!error}
      onCancel={handleClose}
      onSubmit={() => {
        setFilters(filterLines(data))
        handleClose()
      }}
    >
      <div style={{ width: '80em' }}>
        Add filters, in jexl format, one per line, starting with the string
        jexl:. Examples:{' '}
        <ul>
          <li>
            <code>jexl:get(feature,'name')=='BRCA1'</code> - show only features
            where the name attribute is BRCA1
          </li>
          <li>
            <code>jexl:startsWith(get(feature,'name'),'PREFIX')</code> - show
            only features where the string 'PREFIX' is the prefix of the feature
            name. endsWith also works
          </li>
          <li>
            <code>jexl:includes(get(feature,'name'),'PREFIX')</code> - show only
            features where the string 'PREFIX' appears in the feature name
          </li>
          <li>
            <code>jexl:get(feature,'type')=='gene'</code> - show only gene type
            features in a GFF that has many other feature types
          </li>
          <li>
            <code>jexl:get(feature,'score') &gt; 400</code> - show only features
            that have a score greater than 400
          </li>
          <li>
            <code>
              jexl:get(feature,'end') - get(feature,'start') &lt; 1000000
            </code>{' '}
            - show only features with length less than 1Mbp
          </li>
        </ul>
        <p>
          Please see the{' '}
          <ExternalLink href="https://jbrowse.org/jb2/docs/config_guides/jexl/">
            Jexl
          </ExternalLink>{' '}
          documentation for more information
        </p>
      </div>

      <MonospaceTextField
        fullWidth
        minRows={5}
        maxRows={10}
        value={data}
        error={error}
        onChange={val => {
          setData(val)
        }}
      />
    </SubmitDialog>
  )
})

export default JexlFilterDialog
