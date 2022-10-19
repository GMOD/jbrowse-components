---
id: referencesequencetrack
title: ReferenceSequenceTrack
toplevel: true
---

used to display base level DNA sequence tracks

#### slot: adapter

!type AdapterType
configuration for track adapter

```js
adapter: pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: displays

!type DisplayType[]
configuration for the displays e.g. LinearReferenceSequenceDisplay

```js
displays: types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: name

```js
name: {
        type: 'string',
        description:
          'optional track name, otherwise uses the "Reference sequence (assemblyName)"',
        defaultValue: '',
      }
```

#### slot: metadata

```js
metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      }
```
