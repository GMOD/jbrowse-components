# The JBrowse 2 Configuration System

JBrowse 2 configuration is kept in a specialized mobx-state-tree tree. Each node in the tree is a ConfigurationSchema. ConfigurationSchemas contain ConfigurationSlot members and/or additional sub-schemas.

Each "configuration variable" is held in a ConfigurationSlot, which has a string `type` name, which is something like 'string', or 'color'. Each config slot can hold either a fixed value, or a function that can be called to produce a value.

## Configuration slot types

These types are specific to configuration schemas.

* string
* number
* integer
* color

## Configuration schemas

## Overriding

A configuration schema can also have a "layer parent"
