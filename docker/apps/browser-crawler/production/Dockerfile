# Generate Base Image
FROM apify/actor-node-puppeteer-chrome:22-24.7.2 AS base
ENV PNPM_HOME="~/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
USER root
RUN npm install pnpm --global
USER myuser
RUN pnpm config set store-dir ~/.pnpm-store

# Prune Project
FROM base AS pruner
ARG PROJECT
WORKDIR /app
COPY --chown=myuser . .
RUN pnpm install -g turbo && turbo prune --scope=@pneuma/${PROJECT} --docker

# Build Project
FROM base AS build
ARG PROJECT
WORKDIR /usr/src/monorepo
COPY --from=pruner /app/out/full/ /usr/src/monorepo/
COPY --from=pruner /app/out/json/pnpm-lock.yaml /usr/src/monorepo/
RUN pnpm install --prod false && pnpm turbo:build:app

# --------------> The production image
FROM base AS runner
ARG PROJECT
ENV NODE_ENV=production

USER myuser

WORKDIR /usr/src/monorepo
COPY --chown=myuser --from=build /usr/src/monorepo/apps/${PROJECT}/.dist /usr/src/monorepo/apps/${PROJECT}/.dist

COPY --from=pruner --chown=myuser /app/out/json/ /usr/src/monorepo/
RUN pnpm install --frozen-lockfile --no-optional

WORKDIR /usr/src/monorepo/apps/${PROJECT}

CMD ~/start_xvfb_and_run_cmd.sh && node .dist/server.js
