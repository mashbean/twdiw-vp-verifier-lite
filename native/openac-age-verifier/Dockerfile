# The native OpenAC age-proof verifier, as a Cloudflare Container.
#
# Two things make this image unusual: it must run on linux/amd64 (a Cloudflare
# Containers requirement) and it carries 417 MB of verifying key. The keys are
# baked in rather than downloaded at start-up because container disk is
# ephemeral — a fresh disk on every cold start would mean expanding 412 MB from
# gzip on a fractional vCPU before the first proof could be checked.
#
# Both the compressed transport and the installed bytes are checked here, with
# the same digests `src/main.rs` re-checks at start-up and `docs/` records for
# the openac-age-v1 release. A republished asset fails the build.

# ---------------------------------------------------------------------------
# 1. The service itself.
FROM --platform=linux/amd64 rust:1-slim-bookworm AS build
WORKDIR /src
# git: three dependencies (zkID, Spartan2, circom-scotia) are git revisions.
# The witness calculator is NOT built — `ecdsa-spartan2` is taken with
# default-features off — so no C++ toolchain or GMP is needed here.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked && strip target/release/openac-age-verifier

# ---------------------------------------------------------------------------
# 2. The verifying keys, pinned twice.
FROM --platform=linux/amd64 debian:bookworm-slim AS keys
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /keys
ARG RELEASE=https://github.com/bonds-tw/backupTW-iOS/releases/download/openac-age-v1
RUN set -eux; \
    for pin in \
      "prepare_verifying.key d84ef20b28f0dd26b836022fc023424592d476a80b54d9ab80d51e43f698ee6a 9b45cc7462a236b1056d21c19e1e4dfc2cf52fd20538d43fbe072d9ed106e9d6 431866442" \
      "show_verifying.key b6daa9cefd23d27ce80bd182ced987caa1a4eeb91083fc6ceafbeb1210dfbad0 f0c447a9757d182e8aa23083bc3dba5a9a22f3e0fcbb344724568cc3c83352d8 4862746" \
    ; do \
      set -- $pin; name=$1; gzip_sha=$2; installed_sha=$3; installed_bytes=$4; \
      curl -fL --retry 3 -o "$name.gz" "$RELEASE/$name.gz"; \
      echo "$gzip_sha  $name.gz" | sha256sum -c -; \
      gunzip "$name.gz"; \
      echo "$installed_sha  $name" | sha256sum -c -; \
      test "$(stat -c %s "$name")" = "$installed_bytes"; \
    done

# ---------------------------------------------------------------------------
# 3. What actually runs.
FROM --platform=linux/amd64 debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --create-home --uid 10001 openac
COPY --from=keys /keys/prepare_verifying.key /keys/show_verifying.key /opt/openac/keys/
COPY --from=build /src/target/release/openac-age-verifier /usr/local/bin/openac-age-verifier
USER openac
ENV OPENAC_AGE_KEYS_DIR=/opt/openac/keys \
    OPENAC_AGE_BIND=0.0.0.0:8787 \
    RUST_LOG=info
EXPOSE 8787
# The service re-checks both key digests before it binds, so a container that
# answers /healthz is a container whose keys match the release.
ENTRYPOINT ["/usr/local/bin/openac-age-verifier"]
