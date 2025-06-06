#!/bin/bash

JB2TMP=${JB2TMP:-~/jb2tmp}
mkdir $JB2TMP
cd $JB2TMP
git clone git@github.com:GMOD/jbrowse-react-linear-genome-view-vanillajs-demo
git clone git@github.com:GMOD/jbrowse-react-linear-genome-view-vite-demo
git clone git@github.com:GMOD/jbrowse-react-linear-genome-view-farm-demo
git clone git@github.com:GMOD/jbrowse-react-linear-genome-view-rsbuild-demo
git clone git@github.com:GMOD/jbrowse-react-linear-genome-view-nextjs-demo

git clone git@github.com:GMOD/jbrowse-react-circular-genome-view-vanillajs-demo
git clone git@github.com:GMOD/jbrowse-react-circular-genome-view-nextjs-demo

git clone git@github.com:GMOD/jbrowse-react-app-nextjs-demo
git clone git@github.com:GMOD/jbrowse-react-app-vite-demo
git clone git@github.com:GMOD/jbrowse-react-app-farm-demo
git clone git@github.com:GMOD/jbrowse-react-app-rsbuild-demo
git clone git@github.com:GMOD/jbrowse-react-app-vanillajs-demo
cd -
