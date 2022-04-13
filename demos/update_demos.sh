#!/bin/bash
cd jbrowse-react-linear-genome-view
yarn upgrade
yarn deploy
cd -
cd jbrowse-react-circular-genome-view
yarn upgrade
yarn deploy
cd -
cd jbrowse-react-linear-genome-view-cra5
yarn upgrade
yarn deploy
cd -
cd jbrowse-react-circular-genome-view-cra5
yarn upgrade
yarn deploy
cd -


