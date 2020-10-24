#!/bin/bash
SRC := $(shell node read_sidebar.js)
SRC_FILES := $(filter-out combined.md, $(SRC))
SRC_FILES2 := $(filter-out pdfcombined.md, $(SRC_FILES))
COMMITSHA := $(shell git rev-parse --short HEAD)
TITLE := $(shell sed -e 's/git-commit-sha/git revision $(COMMITSHA)/' title.md > titlemod.md)

all: md pdf

pdf: $(SRC_FILES2)
	@for f in $(SRC_FILES2); do cat $${f} | node tex_parser.js; done > pdfcombined.md

realpdf: pdf
	pandoc titlemod.md pdfcombined.md --listings -H listings.tex  --toc -o jbrowse2.pdf

md: $(SRC_FILES2)
	@(echo '---\ntitle: JBrowse 2 combined guide\nid: combined\n---\n\nThis document is a collection of all our documentation. It includes our quick start guide, user guide, configuration guide, CLI guide, developer guide, and FAQ. You can browse the other documents individually, but this page is to help simple ctrl+f searching and easy browsing. You can also download a pdf version of these same docs located at https://jbrowse.org/jb2/jbrowse2.pdf\n\n' && for f in $(SRC_FILES2); do cat $${f} | node md_parser.js; done) > combined.md

.PHONY: all

