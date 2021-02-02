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

# Obtain schemas
mkdir -p xsds && cd xsds
REPOSITORY=experiments
[ -z "$(git ls-remote --heads  https://bitbucket.org/hbpneurorobotics/${REPOSITORY}.git ${TOPIC_BRANCH})" ] \
        && CO_BRANCH="${DEFAULT_BRANCH}" \
        || CO_BRANCH="${TOPIC_BRANCH}"
bash ../.ci/bitbucket_api_get.bash "${REPOSITORY}" ExDConfFile.xsd "${CO_BRANCH}"
cat ExDConfFile.xsd
cd ..

. $HOME/.bashrc
source $HOME/.nvm/nvm.sh && nvm alias default 8 && nvm use default

sudo apt-get update && sudo apt-get install -y virtualenv

# Install npm packages 
npm install

# Checking for un-prettified file
echo "Checking for un-prettified file"
node_modules/prettier/bin-prettier.js --list-different "{**/,}*.{js,scss}"

npm test
