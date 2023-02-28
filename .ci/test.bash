#!/bin/bash
set -e
set -o xtrace

whoami
env | sort
pwd

# Checking for un-prettified file
echo "Checking for un-prettified file"
node_modules/prettier/bin-prettier.js --check "{**/,}*.{js,scss}" \
    && echo "bin-prettier.js is successful" \
    || { echo "bin-prettier.js exited with non-zero code, look at it output." ; exit 1 ; }

npm test || echo "Tests failed."
