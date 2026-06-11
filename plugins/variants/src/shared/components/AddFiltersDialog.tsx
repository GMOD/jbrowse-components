import { useState } from 'react'

import {
  ExternalLink,
  MonospaceTextField,
  SubmitDialog,
} from '@jbrowse/core/ui'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { observer } from 'mobx-react'

function checkJexl(code: string) {
  stringToJexlExpression(code)
}

const AddFiltersDialog = observer(function AddFiltersDialog({
  model,
  handleClose,
}: {
  model: {
    jexlFilters?: string[]
    setJexlFilters: (arg?: string[]) => void
  }
  handleClose: () => void
}) {
  const { jexlFilters } = model
  const [data, setData] = useState((jexlFilters ?? []).join('\n'))

  let error: unknown
  try {
    for (const line of data
      .split('\n')
      .map(line => line.trim())
      .filter(line => !!line)) {
      checkJexl(line)
    }
  } catch (e) {
    error = e
  }

  return (
    <SubmitDialog
      maxWidth="xl"
      open
      title="Add track filters"
      submitDisabled={!!error}
      onCancel={handleClose}
      onSubmit={() => {
        const lines = data
          .split('\n')
          .map(line => line.trim())
          .filter(line => !!line)
        model.setJexlFilters(lines.length > 0 ? lines : undefined)
        handleClose()
      }}
    >
      <div>
        Add filters, in jexl format, one per line, starting with the string
        jexl:. Examples:{' '}
        <ul>
          <li>
            <code>jexl:get(feature,'name')=='BRCA1'</code> - show only feature
            where the name attribute is BRCA1
          </li>
          <li>
            <code>jexl:startsWith(get(feature,'name'),'PREFIX')</code> - show
            only feature where the string 'PREFIX' is the prefix of feature
            name. endsWith also works
          </li>
          <li>
            <code>jexl:includes(get(feature,'name'),'PREFIX')</code> - show only
            feature where the string 'PREFIX' is the prefix of feature name
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
          Please see{' '}
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

export default AddFiltersDialog
