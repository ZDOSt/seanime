# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS web
WORKDIR /src/seanime-web

COPY seanime-web/package*.json ./
RUN npm ci

COPY seanime-web/ ./
RUN npm run build

FROM golang:1.26.2-bookworm AS server
ARG TARGETOS
ARG TARGETARCH
ARG TARGETVARIANT
WORKDIR /src

COPY . .
COPY --from=web /src/seanime-web/out ./web

RUN set -eux; \
    if [ "${TARGETARCH}" = "arm" ] && [ "${TARGETVARIANT}" = "v7" ]; then \
        export GOARM=7; \
    fi; \
    CGO_ENABLED=0 GOOS="${TARGETOS:-linux}" GOARCH="${TARGETARCH:-amd64}" \
    go build -trimpath -ldflags="-s -w" -o /out/seanime .

FROM umagistr/seanime:v3.10.2
COPY --from=server /out/seanime /app/seanime
