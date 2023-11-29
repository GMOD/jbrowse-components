import React from 'react'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

// locals
import RefNameAutocomplete from './RefNameAutocomplete'
import { fetchResults } from './util'
import { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const ImportFormRefNameAutocomplete = observer(function ({
  model,
  selectedAsm,
  value,
  setValue,
  setOption,
}: {
  value: string
  setValue: (arg: string) => void
  model: LGV
  selectedAsm: string
  setOption: (arg: BaseResult) => void
}) {
  const session = getSession(model)
  const { assemblyManager, textSearchManager } = session
  const { rankSearchResults } = model
  const searchScope = model.searchScope(selectedAsm)
  const assembly = assemblyManager.get(selectedAsm)
  return (
    <RefNameAutocomplete
      fetchResults={queryString =>
        fetchResults({
          queryString,
          assembly,
          textSearchManager,
          rankSearchResults,
          searchScope,
        })
      }
      model={model}
      assemblyName={selectedAsm}
      value={value}
      minWidth={270}
      onChange={str => setValue(str)}
      onSelect={val => setOption(val)}
      TextFieldProps={{
        variant: 'outlined',
        helperText: 'Enter sequence name, feature name, or location',
      }}
    />
  )
})

export default ImportFormRefNameAutocomplete
