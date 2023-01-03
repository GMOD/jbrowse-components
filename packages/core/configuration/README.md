# The JBrowse 2 Configuration System

JBrowse 2 configuration is kept in a specialized mobx-state-tree tree. Each node
in the tree is a ConfigurationSchema. ConfigurationSchemas contain
ConfigurationSlot members and/or additional sub-schemas.

Each "configuration variable" is held in a ConfigurationSlot, which has a string
`type` name, which is something like 'string', or 'color'. Each config slot can
hold either a fixed value, or a function that can be called to produce a value.

## Configuration slot types

These types are specific to configuration schemas.

- `string`
- `number`
- `integer`
- `boolean`
- `color` - a color, usually used in renderer configs
- `stringArray` - an array of strings
- `stringArrayMap` - map of string -> array[string]
- `numberMap` - map of string -> number
- `fileLocation` of the form
  ```
  { uri: 'http://example.com/path/to/resource.file', locationType: 'UriLocation' }
  ```
  or
  ```
  { localPath: '/filesystem/path/to/resource.file', locationType: 'LocalPathLocation' }
  ```
- `frozen` - any data structure. assumed to be immutable; internal changes to it
  will not be noticed by any mobx observers

## Configuration Layers

There is also a configuration construct called a `ConfigurationLayer` that acts
as a "layer over" another configuration schema. It has the same slots, with the
same types, but all of its slot values default to whatever the default of of the
corresponding slot in the parent schema is.

These are useful for "overriding" only some values of a parent schema, such as
for providing a cascading configuration system for subtracks.
