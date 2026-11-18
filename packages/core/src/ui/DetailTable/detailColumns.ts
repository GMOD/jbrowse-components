import { cellText } from '../../util/tableText.ts'

export interface DetailTableColumn<R> {
  field: string
  /** the field when unset */
  header?: string
  /** the header's hover text */
  description?: string
  /** what the column sorts by */
  value: (row: R) => unknown
  /**
   * the cell as plain text, which sizes the column and which the search, a
   * cell's hover and the CSV read; the value as text when unset
   */
  text?: (row: R) => string
  /** draws the cell; the text when unset */
  cell?: (row: R) => React.ReactNode
}

export function columnText<R>(col: DetailTableColumn<R>) {
  return col.text ?? ((row: R) => cellText(col.value(row)))
}
