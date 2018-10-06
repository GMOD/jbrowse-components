[![Build Status](https://travis-ci.com/GMOD/jbrowse-components.svg?branch=master)](https://travis-ci.com/GMOD/jbrowse-components)

# jbrowse-components

Lerna-managed monorepo containing many related packages for next-generation JBrowse development.

## Development environment setup

```sh
npm install -g lerna
cd jbrowse-components
lerna bootstrap
```

## To add a package

1. Add a `PROJECT=...` line in the matrix section of .travis.yml

2. Add a line to the cache section of the .travis.yml to cache your package's node modules

3. Make a `.travis.sh` script in your package's directory. This will be run by travis when a file in that package has changed.