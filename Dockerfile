FROM node:20

ARG STORAGE_PATH=/nrpStorage

ENV STORAGE_PATH ${STORAGE_PATH}
RUN mkdir ${STORAGE_PATH}

WORKDIR /nrp-proxy-app

COPY . .

COPY config.json.sample.docker config.json

RUN npm install

CMD [ "npm", "start" ]