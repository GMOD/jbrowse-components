import shortid from 'shortid'
import { types } from 'mobx-state-tree'
import propTypes from 'prop-types'
import { PropTypes as MxPropTypes } from 'mobx-react'

import { assembleLocString } from './util'

export const ElementId = types.optional(types.identifier, shortid.generate)

// PropTypes that are useful when working with instances of these in react components
export const PropTypes = {
  Region: propTypes.shape({
    assemblyName: propTypes.string.isRequired,
    refName: propTypes.string.isRequired,
    start: propTypes.number.isRequired,
    end: propTypes.number.isRequired,
  }),
  ConfigSchema: MxPropTypes.objectOrObservableObject,
  Feature: propTypes.shape({
    get: propTypes.func.isRequired,
    id: propTypes.func.isRequired,
  }),
}

export const Region = types
  .model('Region', {
    assemblyName: types.string,
    refName: types.string,
    start: types.integer,
    end: types.integer,
  })
  .views(self => ({
    get locString() {
      return assembleLocString(self)
    },
  }))

export const FileLocalPath = types.model('FileLocalPath', {
  localPath: types.string, // TODO: refine
})

export const Uri = types.model('Uri', {
  uri: types.string, // TODO: refine
})

export const FileLocation = types.union(FileLocalPath, Uri)
