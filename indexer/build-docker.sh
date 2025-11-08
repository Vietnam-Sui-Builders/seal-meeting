#!/usr/bin/env bash
# =============================================================================
# SmashBlob Indexer Alt - Docker Build Script
# =============================================================================
# Optimized build script with caching and multi-platform support
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="${IMAGE_NAME:-smashblob-indexer-alt}"
REGISTRY="${REGISTRY:-docker.io}"
DOCKER_USERNAME="${DOCKER_USERNAME:-12091999}"
VERSION="${VERSION:-latest}"
PLATFORM="${PLATFORM:-linux/amd64,linux/arm64}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
BUILD_TYPE="${1:-local}"

case "$BUILD_TYPE" in
    local)
        log_info "Building for local development (linux/amd64)..."
        docker build \
            --tag "${IMAGE_NAME}:${VERSION}" \
            --tag "${IMAGE_NAME}:latest" \
            --platform linux/amd64 \
            --progress=plain \
            .
        log_success "Local build complete!"
        log_info "Run with: docker run --rm --env-file .env ${IMAGE_NAME}:latest"
        ;;

    multi-platform)
        log_info "Building multi-platform image (${PLATFORM})..."

        # Enable buildx if not already
        if ! docker buildx inspect multiplatform-builder &>/dev/null; then
            log_info "Creating buildx builder..."
            docker buildx create --name multiplatform-builder --use
        else
            docker buildx use multiplatform-builder
        fi

        docker buildx build \
            --tag "${IMAGE_NAME}:${VERSION}" \
            --tag "${IMAGE_NAME}:latest" \
            --platform "${PLATFORM}" \
            --progress=plain \
            --load \
            .

        log_success "Multi-platform build complete!"
        ;;

    push)
        log_info "Building and pushing to registry..."

        FULL_IMAGE_NAME="${REGISTRY}/${DOCKER_USERNAME}/${IMAGE_NAME}"

        log_info "Logging into Docker registry..."
        if [ -z "${DOCKER_PASSWORD:-}" ]; then
            log_warning "DOCKER_PASSWORD not set, attempting interactive login..."
            docker login "${REGISTRY}" -u "${DOCKER_USERNAME}"
        else
            echo "${DOCKER_PASSWORD}" | docker login "${REGISTRY}" -u "${DOCKER_USERNAME}" --password-stdin
        fi

        # Build for multiple platforms
        if ! docker buildx inspect multiplatform-builder &>/dev/null; then
            log_info "Creating buildx builder..."
            docker buildx create --name multiplatform-builder --use
        else
            docker buildx use multiplatform-builder
        fi

        docker buildx build \
            --tag "${FULL_IMAGE_NAME}:${VERSION}" \
            --tag "${FULL_IMAGE_NAME}:latest" \
            --platform "${PLATFORM}" \
            --progress=plain \
            --push \
            .

        log_success "Image pushed to ${FULL_IMAGE_NAME}:${VERSION}"
        log_success "Image pushed to ${FULL_IMAGE_NAME}:latest"
        ;;

    test)
        log_info "Building test image..."
        docker build \
            --tag "${IMAGE_NAME}:test" \
            --target builder \
            --progress=plain \
            .

        log_info "Running cargo test inside container..."
        docker run --rm "${IMAGE_NAME}:test" cargo test

        log_success "Tests passed!"
        ;;

    size)
        log_info "Analyzing image size..."
        docker build --tag "${IMAGE_NAME}:size-test" . > /dev/null

        echo ""
        log_info "Image layers:"
        docker history "${IMAGE_NAME}:size-test" --human=true --format "table {{.CreatedBy}}\t{{.Size}}"

        echo ""
        SIZE=$(docker images "${IMAGE_NAME}:size-test" --format "{{.Size}}")
        log_info "Total image size: ${SIZE}"
        ;;

    clean)
        log_info "Cleaning up Docker artifacts..."

        # Remove indexer images
        docker images | grep "${IMAGE_NAME}" | awk '{print $3}' | xargs -r docker rmi -f || true

        # Clean build cache
        docker builder prune -f

        # Remove buildx builder
        docker buildx rm multiplatform-builder || true

        log_success "Cleanup complete!"
        ;;

    *)
        log_error "Unknown build type: ${BUILD_TYPE}"
        echo ""
        echo "Usage: $0 {local|multi-platform|push|test|size|clean}"
        echo ""
        echo "Commands:"
        echo "  local           - Build for local development (linux/amd64)"
        echo "  multi-platform  - Build for multiple platforms (amd64, arm64)"
        echo "  push            - Build and push to registry"
        echo "  test            - Build and run tests"
        echo "  size            - Analyze image size"
        echo "  clean           - Clean up Docker artifacts"
        echo ""
        echo "Environment variables:"
        echo "  IMAGE_NAME      - Image name (default: smashblob-indexer-alt)"
        echo "  VERSION         - Image version (default: latest)"
        echo "  REGISTRY        - Docker registry (default: docker.io)"
        echo "  DOCKER_USERNAME - Docker username (default: 12091999)"
        echo "  DOCKER_PASSWORD - Docker password (for push command)"
        echo "  PLATFORM        - Target platforms (default: linux/amd64,linux/arm64)"
        exit 1
        ;;
esac

log_success "Done!"
