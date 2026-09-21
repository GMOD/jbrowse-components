import { makeStyles } from '../../util/tss-react/index.ts'
import BasicValue from './BasicValue.tsx'
import FieldActionsButton, {
  useRevealFieldActions,
} from './FieldActionsButton.tsx'
import FieldName from './FieldName.tsx'

import type { FeatureFormatter, FieldActions } from '../types.tsx'

const useStyles = makeStyles()({
  field: {
    display: 'flex',
    flexWrap: 'wrap',
  },
})

export default function SimpleField({
  name,
  value,
  description,
  prefix,
  width,
  formatter,
  fieldActions,
}: {
  description?: React.ReactNode
  name: string
  value: unknown
  prefix?: string[]
  width?: number
  formatter?: FeatureFormatter
  fieldActions?: FieldActions
}) {
  const { classes, cx } = useStyles()
  const reveal = useRevealFieldActions()
  return value != null ? (
    <div className={cx(classes.field, reveal)}>
      <FieldName
        prefix={prefix}
        description={description}
        name={name}
        width={width}
      />
      <BasicValue value={formatter ? formatter(value, name) : value} />
      <FieldActionsButton
        path={[...(prefix ?? []), name]}
        value={value}
        fieldActions={fieldActions}
      />
    </div>
  ) : null
}
