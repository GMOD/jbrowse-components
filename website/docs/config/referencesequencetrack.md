---
id: referencesequencetrack
title: ReferenceSequenceTrack
toplevel: true
---
used to display base level DNA sequence tracks
#### slot: adapter
```js

      /**
       * !slot adapter
       * !type AdapterType
       * configuration for track adapter
       */
      adapter: pluginManager.pluggableConfigSchemaType('adapter')
```
#### slot: displays
```js


      /**
       * !slot displays
       * !type DisplayType[]
       * configuration for the displays e.g. LinearReferenceSequenceDisplay
       */
      displays: types.array(pluginManager.pluggableConfigSchemaType('display'))
```
#### slot: name
```js


      /**
       * !slot name
       */
      name: {
        type: 'string',
        description:
          'optional track name, otherwise uses the "Reference sequence (assemblyName)"',
        defaultValue: '',
      }
```
#### slot: metadata
```js


      /**
       * !slot metadata
       */
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      }
```
