#!/bin/bash
set -e
set -o xtrace

whoami
env | sort
pwd

if [ -f .ci/env ]; then
    # add quotes to all vars (but do it once)
    sudo sed -i -E 's/="*(.*[^"])"*$/="\1"/' .ci/env 
    source '.ci/env'
fi

. $HOME/.bashrc
source $HOME/.nvm/nvm.sh && nvm alias default 8 && nvm use default

sudo apt-get update && sudo apt-get install -y virtualenv

# Install npm packages 
npm install

# Checking for un-prettified file
echo "Checking for un-prettified file"
node_modules/prettier/bin-prettier.js --list-different "{**/,}*.{js,scss}"

npm test
