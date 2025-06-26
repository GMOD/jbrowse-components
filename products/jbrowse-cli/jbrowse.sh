#!/bin/bash

set -e

# Function to show usage
usage() {
  echo "Usage: $0 create <path> [--force] [--url <url>] [--tag <tag>]"
  echo "       $0 add-track <track> [--load <copy|symlink|move|inPlace>]"
  echo "       $0 make-pif <file> [--out <output>] [--csi]"
  echo "       $0 sort-gff <file>"
  echo "       $0 upgrade [<path>] [--tag <tag>] [--url <url>] [--clean]"
  echo "       $0 text-index [--tracks <ids>] [--assemblies <names>] [--attributes <attrs>] [--out <path>]"
  exit 1
}

# Function to download and extract JBrowse
create() {
  LOCALPATH="$1"
  FORCE=false
  URL=""
  TAG=""

  # Parse arguments
  shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --force)
        FORCE=true
        shift
        ;;
      --url)
        URL="$2"
        shift 2
        ;;
      --tag)
        TAG="$2"
        shift 2
        ;;
      *)
        echo "Unknown argument: $1"
        usage
        ;;
    esac
  done

  # Check if path is provided
  if [ -z "$LOCALPATH" ]; then
    echo "Error: Missing path for create command."
    usage
  fi

  # Check if directory exists and is not empty
  if [ -d "$LOCALPATH" ] && [ "$(ls -A "$LOCALPATH")" ] && [ "$FORCE" = false ]; then
    echo "Error: Directory '$LOCALPATH' is not empty. Use --force to overwrite."
    exit 1
  fi

  # Create directory if it doesn't exist
  mkdir -p "$LOCALPATH"

  # Determine download URL
  if [ -n "$URL" ]; then
    DOWNLOAD_URL="$URL"
  elif [ -n "$TAG" ]; then
    DOWNLOAD_URL="https://github.com/GMOD/jbrowse-components/releases/download/${TAG}/jbrowse-web-${TAG}.zip"
  else
    LATEST_RELEASE=$(curl -s "https://api.github.com/repos/GMOD/jbrowse-components/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    DOWNLOAD_URL="https://github.com/GMOD/jbrowse-components/releases/download/${LATEST_RELEASE}/jbrowse-web-${LATEST_RELEASE}.zip"
  fi

  # Download and extract
  echo "Downloading from $DOWNLOAD_URL..."
  curl -L "$DOWNLOAD_URL" -o jbrowse.zip
  echo "Extracting to $LOCALPATH..."
  unzip -q jbrowse.zip -d "$LOCALPATH"
  rm jbrowse.zip

  echo "JBrowse 2 created at $LOCALPATH"
}

add_track() {
  TRACK_FILE="$1"
  LOAD_METHOD="inPlace"
  CONFIG_FILE="config.json"

  # Parse arguments
  shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --load)
        LOAD_METHOD="$2"
        shift 2
        ;;
      *)
        echo "Unknown argument: $1"
        usage
        ;;
    esac
  done

  # Check if track file is provided
  if [ -z "$TRACK_FILE" ]; then
    echo "Error: Missing track file for add-track command."
    usage
  fi

  # Check if config.json exists
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: config.json not found in the current directory."
    exit 1
  fi

  # Get track info
  TRACK_ID=$(basename "$TRACK_FILE" | sed -E 's/\.[^.]+$//')
  TRACK_TYPE="FeatureTrack"
  ASSEMBLY_NAME=$(jq -r '.assemblies[0].name' "$CONFIG_FILE")

  # Create track configuration
  TRACK_CONFIG="{\"type\": \"$TRACK_TYPE\", \"trackId\": \"$TRACK_ID\", \"name\": \"$TRACK_ID\", \"assemblyNames\": [\"$ASSEMBLY_NAME\"], \"adapter\": {\"type\": \"BedTabixAdapter\", \"bedGzLocation\": {\"uri\": \"$TRACK_FILE\"}}}"

  # Add track to config.json
  jq --argjson new_track "$TRACK_CONFIG" '.tracks += [$new_track]' "$CONFIG_FILE" > tmp.json && mv tmp.json "$CONFIG_FILE"

  echo "Added track $TRACK_ID to $CONFIG_FILE"

  # Perform file operation
  if [ "$LOAD_METHOD" != "inPlace" ]; then
    if [ "$LOAD_METHOD" == "copy" ]; then
      cp "$TRACK_FILE" .
    elif [ "$LOAD_METHOD" == "symlink" ]; then
      ln -s "$TRACK_FILE" .
    elif [ "$LOAD_METHOD" == "move" ]; then
      mv "$TRACK_FILE" .
    fi
  fi
}

make_pif() {
  INPUT_FILE="$1"
  OUTPUT_FILE=""
  CSI_INDEX=false

  shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --out)
        OUTPUT_FILE="$2"
        shift 2
        ;;
      --csi)
        CSI_INDEX=true
        shift
        ;;
      *)
        echo "Unknown argument: $1"
        usage
        ;;
    esac
  done

  if [ -z "$INPUT_FILE" ]; then
    echo "Error: Missing input PAF file for make-pif command."
    usage
  fi

  # Check for required commands
  for cmd in sort bgzip tabix;
  do
    if ! command -v "$cmd" &> /dev/null;
    then
      echo "Error: Required command '$cmd' not found. Please install it."
      exit 1
    fi
  done

  # Determine output file name
  if [ -z "$OUTPUT_FILE" ]; then
    BASE_NAME=$(basename "$INPUT_FILE" .paf)
    OUTPUT_FILE="${BASE_NAME}.pif.gz"
  fi

  # Process the PAF file
  # This awk script reorders columns and generates two lines for each input line
  # It does NOT implement the complex CIGAR string manipulation from the original TS code
  awk -F'\t' '{
    # First output line (target-query)
    print "t" $6 "\t" $7 "\t" $8 "\t" $9 "\t" $5 "\t" $1 "\t" $2 "\t" $3 "\t" $4 "\t" $10 "\t" $11 "\t" $12 "\t" $13 "\t" $14 "\t" $15 "\t" $16 "\t" $17 "\t" $18 "\t" $19 "\t" $20 "\t" $21 "\t" $22 "\t" $23 "\t" $24 "\t" $25 "\t" $26 "\t" $27 "\t" $28 "\t" $29 "\t" $30 "\t" $31 "\t" $32 "\t" $33 "\t" $34 "\t" $35 "\t" $36 "\t" $37 "\t" $38 "\t" $39 "\t" $40 "\t" $41 "\t" $42 "\t" $43 "\t" $44 "\t" $45 "\t" $46 "\t" $47 "\t" $48 "\t" $49 "\t" $50

    # Second output line (query-target)
    print "q" $1 "\t" $2 "\t" $3 "\t" $4 "\t" $5 "\t" $6 "\t" $7 "\t" $8 "\t" $9 "\t" $10 "\t" $11 "\t" $12 "\t" $13 "\t" $14 "\t" $15 "\t" $16 "\t" $17 "\t" $18 "\t" $19 "\t" $20 "\t" $21 "\t" $22 "\t" $23 "\t" $24 "\t" $25 "\t" $26 "\t" $27 "\t" $28 "\t" $29 "\t" $30 "\t" $31 "\t" $32 "\t" $33 "\t" $34 "\t" $35 "\t" $36 "\t" $37 "\t" $38 "\t" $39 "\t" $40 "\t" $41 "\t" $42 "\t" $43 "\t" $44 "\t" $45 "\t" $46 "\t" $47 "\t" $48 "\t" $49 "\t" $50
  }' "$INPUT_FILE" | \
  sort -t$'\t' -k1,1 -k3,3n | \
  bgzip > "$OUTPUT_FILE"

  TABIX_OPTIONS="-s1 -b3 -e4 -0"
  if [ "$CSI_INDEX" = true ]; then
    TABIX_OPTIONS="-C $TABIX_OPTIONS"
  fi

  tabix $TABIX_OPTIONS "$OUTPUT_FILE"

  echo "Created PIF file: $OUTPUT_FILE and index: ${OUTPUT_FILE}.tbi"
}

sort_gff() {
  INPUT_FILE="$1"

  if [ -z "$INPUT_FILE" ]; then
    echo "Error: Missing input GFF file for sort-gff command."
    usage
  fi

  # Check for required commands
  for cmd in sort grep;
  do
    if ! command -v "$cmd" &> /dev/null;
    then
      echo "Error: Required command '$cmd' not found. Please install it."
      exit 1
    fi
  done

  # Sort the GFF file
  (grep "^#" "$INPUT_FILE"; grep -v "^#" "$INPUT_FILE" | sort -t$'\t' -k1,1 -k4,4n)
}

upgrade() {
  LOCALPATH="${1:-.}"
  TAG=""
  URL=""
  CLEAN=false

  shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --tag)
        TAG="$2"
        shift 2
        ;;
      --url)
        URL="$2"
        shift 2
        ;;
      --clean)
        CLEAN=true
        shift
        ;;
      *)
        echo "Unknown argument: $1"
        usage
        ;;
    esac
  done

  if [ ! -f "$LOCALPATH/manifest.json" ]; then
    echo "Error: No manifest.json found in $LOCALPATH. Are you sure it is a JBrowse 2 installation?"
    exit 1
  fi

  # Determine download URL
  if [ -n "$URL" ]; then
    DOWNLOAD_URL="$URL"
  elif [ -n "$TAG" ]; then
    DOWNLOAD_URL="https://github.com/GMOD/jbrowse-components/releases/download/${TAG}/jbrowse-web-${TAG}.zip"
  else
    LATEST_RELEASE=$(curl -s "https://api.github.com/repos/GMOD/jbrowse-components/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    DOWNLOAD_URL="https://github.com/GMOD/jbrowse-components/releases/download/${LATEST_RELEASE}/jbrowse-web-${LATEST_RELEASE}.zip"
  fi

  echo "Fetching $DOWNLOAD_URL..."
  curl -L "$DOWNLOAD_URL" -o jbrowse.zip

  if [ "$CLEAN" = true ]; then
    echo "Cleaning old files..."
    rm -rf "$LOCALPATH/static"
    find "$LOCALPATH" -maxdepth 1 -type f -name "*worker.js*" -delete
  fi

  echo "Extracting to $LOCALPATH..."
  unzip -o -q jbrowse.zip -d "$LOCALPATH"
  rm jbrowse.zip

  echo "JBrowse 2 upgraded at $LOCALPATH"
}

text_index() {
  echo "The 'text-index' command is complex and relies on the Node.js 'ixixx' library for efficient text indexing."
  echo "A direct, portable bash equivalent for generating .ix and .ixx files is not feasible."
  echo "This bash script can, however, help you extract relevant text from your GFF3/VCF files."
  echo "You would then need to use an external tool or a custom script to build the actual text index."
  echo ""
  echo "Example: Extracting 'ID' and 'Name' attributes from a GFF3 file:"
  echo "  awk -F'\t' '$3 == "gene" { print $9 }' input.gff3 | grep -oP 'ID=[^;]+|Name=[^;]+'"
  echo ""
  echo "Example: Extracting 'ID' from a VCF file:"
  echo "  grep -v '#' input.vcf | awk -F'\t' '{ print $3 }'"
  echo ""
  echo "For full text indexing functionality, consider using the original Node.js JBrowse CLI or a specialized indexing tool."
}

# Main script logic
if [ "$#" -eq 0 ]; then
  usage
fi

case "$1" in
  create)
    shift
    create "$@"
    ;;
  add-track)
    shift
    add_track "$@"
    ;;
  make-pif)
    shift
    make_pif "$@"
    ;;
  sort-gff)
    shift
    sort_gff "$@"
    ;;
  upgrade)
    shift
    upgrade "$@"
    ;;
  text-index)
    shift
    text_index "$@"
    ;;
  *)
    echo "Unknown command: $1"
    usage
    ;;
esac