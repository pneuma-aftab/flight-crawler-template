# Generate Base Image
FROM node:22-alpine AS base
RUN apk add --no-cache dumb-init libc6-compat
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm i -g pnpm

# Prune Project
FROM base AS pruner
ARG PROJECT
WORKDIR /app
COPY --chown=node:node . .
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
ENV NODE_ENV production

USER node

WORKDIR /usr/src/monorepo
COPY --chown=node:node --from=build /usr/src/monorepo/apps/${PROJECT}/.dist /usr/src/monorepo/apps/${PROJECT}/.dist

COPY --from=pruner --chown=node:node /app/out/json/ /usr/src/monorepo/
RUN pnpm install --frozen-lockfile --no-optional

WORKDIR /usr/src/monorepo/apps/${PROJECT}

CMD ["dumb-init", "node", ".dist/server.js"]
