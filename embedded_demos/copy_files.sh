#!/bin/bash

JB2TMP=${JB2TMP:-~/jb2tmp}
## linear
cp base/linear/config.ts $JB2TMP/jbrowse-react-linear-genome-view-vite-demo/src/
cp base/linear/config.ts $JB2TMP/jbrowse-react-linear-genome-view-farm-demo/src/
cp base/linear/config.ts $JB2TMP/jbrowse-react-linear-genome-view-rsbuild-demo/src/
cp base/linear/config.ts $JB2TMP/jbrowse-react-linear-genome-view-nextjs-demo/app/
cp base/linear/config.ts $JB2TMP/jbrowse-react-linear-genome-view-vanillajs-demo/

## circular
cp base/circular/config.ts $JB2TMP/jbrowse-react-circular-genome-view-nextjs-demo/app/
cp base/circular/config.ts $JB2TMP/jbrowse-react-circular-genome-view-vanillajs-demo/

## react app
cp base/app/config.ts $JB2TMP/jbrowse-react-app-vite-demo/src/
cp base/app/config.ts $JB2TMP/jbrowse-react-app-farm-demo/src/
cp base/app/config.ts $JB2TMP/jbrowse-react-app-nextjs-demo/app/
cp base/app/config.ts $JB2TMP/jbrowse-react-app-rsbuild-demo/src/
cp base/app/config.ts $JB2TMP/jbrowse-react-app-vanillajs-demo/
