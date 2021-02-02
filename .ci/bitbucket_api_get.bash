#!/bin/bash
REPOSITORY=$1
FILENAME_XSD=$2
TOPIC_BRANCH=$3

wget https://api.bitbucket.org/2.0/repositories/hbpneurorobotics/${REPOSITORY}/src/${TOPIC_BRANCH}/${FILENAME_XSD} -O ${FILENAME_XSD} \
    && echo ${FILENAME_XSD}:${TOPIC_BRANCH}
