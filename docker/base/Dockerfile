# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:22-bookworm-slim
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS source-pack

ARG VINCU_VERSION

ENV ONNXRUNTIME_NODE_INSTALL=skip

WORKDIR /tmp/vincu-src
COPY . .

RUN set -eux; \
    if [ -n "${VINCU_VERSION:-}" ]; then \
      test "$(node -p "require('./package.json').version")" = "${VINCU_VERSION}"; \
    fi; \
    node -e 'const fs=require("node:fs"); const pkg=JSON.parse(fs.readFileSync("package.json","utf8")); delete pkg.scripts.prepare; fs.writeFileSync("package.json", `${JSON.stringify(pkg)}\n`);'; \
    npm ci

RUN set -eux; \
    mkdir -p /tmp/vincu-packs; \
    npm pack --workspace=@getvincu/highlight --pack-destination /tmp/vincu-packs; \
    npm pack --workspace=@getvincu/relay --pack-destination /tmp/vincu-packs; \
    npm pack --workspace=@getvincu/protocol --pack-destination /tmp/vincu-packs; \
    npm pack --workspace=@getvincu/client --pack-destination /tmp/vincu-packs; \
    npm pack --workspace=@getvincu/server --pack-destination /tmp/vincu-packs; \
    npm pack --workspace=@getvincu/cli --pack-destination /tmp/vincu-packs

FROM ${NODE_IMAGE}

ENV HOME=/home/vincu \
    VINCU_HOME=/home/vincu/.vincu \
    VINCU_LISTEN=0.0.0.0:6767 \
    VINCU_WEB_UI_ENABLED=true \
    VINCU_LOG_FORMAT=json \
    VINCU_LOG_LEVEL=info \
    CLAUDE_CONFIG_DIR=/home/vincu/.claude \
    CODEX_HOME=/home/vincu/.codex \
    XDG_CONFIG_HOME=/home/vincu/.config \
    XDG_DATA_HOME=/home/vincu/.local/share \
    XDG_STATE_HOME=/home/vincu/.local/state \
    XDG_CACHE_HOME=/home/vincu/.cache \
    ONNXRUNTIME_NODE_INSTALL=skip

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      bash \
      ca-certificates \
      curl \
      git \
      gosu \
      lbzip2 \
      openssh-client \
      procps \
      tini; \
    rm -rf /var/lib/apt/lists/*

COPY --from=source-pack /tmp/vincu-packs /tmp/vincu-packs
RUN set -eux; \
	npm install -g /tmp/vincu-packs/*.tgz; \
    rm -rf /tmp/vincu-packs; \
    npm cache clean --force; \
    server_entry="$(npm root -g)/@getvincu/server/dist/scripts/supervisor-entrypoint.js"; \
    test -f "$server_entry"; \
    printf '%s\n' "$server_entry" > /etc/vincu-server-entry; \
    node --check "$server_entry"

RUN set -eux; \
    existing_group="$(getent group 1000 | cut -d: -f1 || true)"; \
    if [ -n "$existing_group" ] && [ "$existing_group" != "vincu" ]; then \
      groupmod --new-name vincu "$existing_group"; \
    elif [ -z "$existing_group" ]; then \
      groupadd --gid 1000 vincu; \
    fi; \
    existing_user="$(getent passwd 1000 | cut -d: -f1 || true)"; \
    if [ -n "$existing_user" ] && [ "$existing_user" != "vincu" ]; then \
      usermod --login vincu --gid vincu --home /home/vincu --shell /bin/bash "$existing_user"; \
    elif [ -z "$existing_user" ]; then \
      useradd --uid 1000 --gid vincu --create-home --home-dir /home/vincu --shell /bin/bash vincu; \
    fi; \
    mkdir -p \
      /workspace \
      "$VINCU_HOME" \
      "$CLAUDE_CONFIG_DIR" \
      "$CODEX_HOME" \
      "$XDG_CONFIG_HOME" \
      "$XDG_DATA_HOME" \
      "$XDG_STATE_HOME" \
      "$XDG_CACHE_HOME"; \
    chown -R vincu:vincu /home/vincu /workspace

COPY docker/base/rootfs/ /
RUN chmod +x /usr/local/bin/vincu-docker-entrypoint

WORKDIR /workspace

EXPOSE 6767
VOLUME ["/home/vincu"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const listen=process.env.VINCU_LISTEN||'0.0.0.0:6767'; const m=listen.match(/:(\\d+)$/); const port=m?Number(m[1]):6767; require('http').get({hostname:'127.0.0.1',port,path:'/api/health'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/vincu-docker-entrypoint"]
