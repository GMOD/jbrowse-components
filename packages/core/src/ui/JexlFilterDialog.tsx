import { useState } from 'react'

import { getEnv } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import { activeJexlFilters } from '../util/jexlFilters.ts'
import {
  ensureJexlPrefix,
  stringToJexlExpression,
} from '../util/jexlStrings.ts'
import ExternalLink from './ExternalLink.tsx'
import MonospaceTextField from './MonospaceTextField.tsx'
import SubmitDialog from './SubmitDialog.tsx'

import type { JexlFilterModel } from '../util/jexlFilters.ts'
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

export interface JexlFilterExample {
  code: string
  description: string
}

/**
 * What a display filtering plain annotation features offers as a starting
 * point. A display whose features are a richer record — a VCF, say — passes its
 * own list instead: the examples are the only place the dialog says what is
 * readable off a feature, so a variant track showing `type=='gene'` is teaching
 * the wrong vocabulary.
 */
const FEATURE_FILTER_EXAMPLES: JexlFilterExample[] = [
  {
    code: "jexl:get(feature,'name')=='BRCA1'",
    description: 'show only features where the name attribute is BRCA1',
  },
  {
    code: "jexl:startsWith(get(feature,'name'),'PREFIX')",
    description:
      "show only features where the string 'PREFIX' is the prefix of the feature name. endsWith also works",
  },
  {
    code: "jexl:includes(get(feature,'name'),'PREFIX')",
    description:
      "show only features where the string 'PREFIX' appears in the feature name",
  },
  {
    code: "jexl:get(feature,'type')=='gene'",
    description:
      'show only gene type features in a GFF that has many other feature types',
  },
  {
    code: "jexl:get(feature,'score') > 400",
    description: 'show only features that have a score greater than 400',
  },
  {
    code: "jexl:get(feature,'end') - get(feature,'start') < 1000000",
    description: 'show only features with length less than 1Mbp',
  },
]

/**
 * Editor for a list of jexl feature filters (one per line), for any display
 * implementing the two-tier {@link JexlFilterModel} contract.
 *
 * It takes the display node rather than a filter list and a setter because the
 * three plugins offering this row each wrote their own 30-line adapter to
 * supply exactly that pair, and the adapters had drifted: one seeded the dialog
 * from the *resolved* filters (so config-declared ones showed up and were
 * editable) and the others from the raw override (so they did not), and only one
 * of them normalized an emptied list. Both are policy this dialog can state
 * once — the dialog is where "the box is empty" becomes a value.
 */
const JexlFilterDialog = observer(function JexlFilterDialog({
  model,
  handleClose,
  examples = FEATURE_FILTER_EXAMPLES,
}: {
  model: JexlFilterModel
  handleClose: () => void
  examples?: JexlFilterExample[]
}) {
  const jexl = getEnv<{ pluginManager: { jexl: JexlInstance } }>(model)
    .pluginManager.jexl
  const [data, setData] = useState(activeJexlFilters(model).join('\n'))
  const error = jexlError(data, jexl)

  return (
    <SubmitDialog
      maxWidth="xl"
      open
      title="Add track filters"
      submitDisabled={!!error}
      onCancel={handleClose}
      onSubmit={() => {
        const lines = filterLines(data).map(ensureJexlPrefix)
        // An emptied box is "show everything", which is NOT the same as
        // following the config slot — it has to survive as a set override, or a
        // track whose config declares filters could never have them cleared.
        // Clearing the override is the "Clear all filters" menu row's job.
        model.setJexlFilters(lines)
        handleClose()
      }}
    >
      <div style={{ width: '80em' }}>
        Add filters, in jexl format, one per line, starting with the string
        jexl:. Examples:{' '}
        <ul>
          {examples.map(({ code, description }) => (
            <li key={code}>
              <code>{code}</code> - {description}
            </li>
          ))}
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
