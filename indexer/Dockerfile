FROM rust:bookworm AS builder

ARG PROFILE=release
ARG GIT_REVISION
ENV GIT_REVISION=$GIT_REVISION

WORKDIR /work

# Copy dependency manifests first
COPY apps/indexer-alt-app/Cargo.lock apps/indexer-alt-app/Cargo.toml ./

# Copy source code
COPY apps/indexer-alt-app/src ./src
COPY apps/indexer-alt-app/migrations ./migrations

RUN apt-get update && apt-get install -y build-essential libssl-dev libpq-dev pkg-config curl cmake clang ca-certificates git
ENV PATH="/root/.cargo/bin:${PATH}"

RUN cargo build --profile $PROFILE --bin smashblob-indexer-alt --config net.git-fetch-with-cli=true

FROM debian:bookworm-slim AS runtime

RUN apt-get update
RUN apt-get -y --no-install-recommends install wget \
        iputils-ping procps bind9-host bind9-dnsutils \
        curl iproute2 git ca-certificates libpq5 libssl3 \
        postgresql-client

WORKDIR /opt/mysten

# Copy binary from builder (handle both release and dev profiles)
COPY --from=builder /work/target/release/smashblob-indexer-alt /opt/mysten/bin/smashblob-indexer-alt
# Copy entry script
COPY apps/indexer-alt-app/entry_indexer.sh /opt/mysten/
RUN ["chmod", "+x", "/opt/mysten/bin/smashblob-indexer-alt"]
RUN ["chmod", "+x", "/opt/mysten/entry_indexer.sh"]

ARG BUILD_DATE
ARG GIT_REVISION
LABEL build-date=$BUILD_DATE
LABEL git-revision=$GIT_REVISION

ENV PATH="/opt/mysten/bin:${PATH}"

CMD ["/opt/mysten/entry_indexer.sh"]