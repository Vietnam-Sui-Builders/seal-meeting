FROM rust:bookworm AS builder

ARG PROFILE=release
ARG GIT_REVISION
ENV GIT_REVISION=$GIT_REVISION

WORKDIR /work

# Copy dependency manifests first
COPY indexer/Cargo.lock indexer/Cargo.toml ./

# Copy source code
COPY indexer/src ./src
COPY indexer/migrations ./migrations

RUN apt-get update && apt-get install -y build-essential libssl-dev libpq-dev pkg-config curl cmake clang ca-certificates git
ENV PATH="/root/.cargo/bin:${PATH}"

RUN cargo build --profile $PROFILE --bin sealmeet-indexer --config net.git-fetch-with-cli=true

FROM debian:bookworm-slim AS runtime

RUN apt-get update
RUN apt-get -y --no-install-recommends install wget \
        iputils-ping procps bind9-host bind9-dnsutils \
        curl iproute2 git ca-certificates libpq5 libssl3 \
        postgresql-client

WORKDIR /opt/mysten

# Copy binary from builder (handle both release and dev profiles)
COPY --from=builder /work/target/release/sealmeet-indexer /opt/mysten/bin/sealmeet-indexer
# Copy entry script
COPY indexer/entry_indexer.sh /opt/mysten/
RUN ["chmod", "+x", "/opt/mysten/bin/sealmeet-indexer"]
RUN ["chmod", "+x", "/opt/mysten/entry_indexer.sh"]

ARG BUILD_DATE
ARG GIT_REVISION
LABEL build-date=$BUILD_DATE
LABEL git-revision=$GIT_REVISION

ENV PATH="/opt/mysten/bin:${PATH}"

CMD ["/opt/mysten/entry_indexer.sh"]