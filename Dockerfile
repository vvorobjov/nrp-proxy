FROM node:8

ARG STORAGE_PATH=/nrpStorage

ENV STORAGE_PATH ${STORAGE_PATH}
RUN mkdir ${STORAGE_PATH}

WORKDIR /nrp-proxy-app

COPY . .

COPY config.json.sample.docker config.json

RUN npm install

# Express listens on config.port (8443 in config.json.sample.docker;
# overridable via the deployed config.json). The healthcheck does a
# TCP probe so it doesn't depend on a specific HTTP route or auth.
# Override the port at run time with PROXY_HEALTHCHECK_PORT if the
# bound port differs from the default. `localhost` resolves to both
# 127.0.0.1 and ::1 via /etc/hosts, so the probe survives an
# IPv6-only bind.
ENV PROXY_HEALTHCHECK_PORT=8443
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('net').connect(parseInt(process.env.PROXY_HEALTHCHECK_PORT,10),'localhost').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" \
      || exit 1

CMD [ "npm", "start" ]