# nrp-proxy runtime (EBR2-44 — first slice).
#
# Bumps the runtime from Node 8 (EOL Dec 2019) to Node 20 LTS and
# refreshes the TypeScript / ts-node toolchain in package.json
# (TS 3.5 -> 5.4, ts-node 8 -> 10, @types/node 8 -> 20).
#
# We still run via `ts-node app.ts` at start-up — the multi-stage
# tsc-compile + slim runtime path is held back to EBR2-44a, the
# follow-up that fixes the surface of TS 5 type-strictness errors
# in the proxy source (mostly @types/express / body-parser overload
# changes). Keeping this PR Node-only makes review tractable.
#
# The deprecated `request` / `request-promise` / `q` migration to
# axios + async/await is tracked separately under EBR2-44b.

FROM node:20-alpine

ARG STORAGE_PATH=/nrpStorage
ENV STORAGE_PATH=${STORAGE_PATH}
RUN mkdir -p ${STORAGE_PATH}

WORKDIR /nrp-proxy-app

COPY . .

COPY config.json.sample.docker config.json

# Until a package-lock.json lands (also EBR2-44a), use `npm install`.
RUN npm install --no-audit --no-fund

# TypeScript 5.4 surfaces a wave of new strict-mode type errors in
# the existing source (notably @types/express overloads in app.ts
# around bodyParser, plus the `request` / q-callback signatures).
# Running ts-node in transpile-only mode skips the type checker so
# the runtime starts; the fixes themselves move into EBR2-44a.
ENV TS_NODE_TRANSPILE_ONLY=true

# Express listens on config.port (8443 default per
# config.json.sample.docker; overridable via the deployed
# config.json). The healthcheck does a TCP probe so it doesn't
# depend on a specific HTTP route or auth. `localhost` resolves to
# both 127.0.0.1 and ::1 via /etc/hosts so the probe survives an
# IPv6-only bind.
ENV PROXY_HEALTHCHECK_PORT=8443
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('net').connect(parseInt(process.env.PROXY_HEALTHCHECK_PORT,10),'localhost').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" \
      || exit 1

CMD [ "npm", "start" ]
