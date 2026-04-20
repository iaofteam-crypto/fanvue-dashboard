#!/usr/bin/env bash
set -euo pipefail

# Fanvue Dashboard — Deployment Helper Script
# Usage: ./scripts/deploy.sh [production|preview|staging]
#
# Prerequisites:
#   - vercel CLI installed globally (npm i -g vercel)
#   - vercel link already run in this project directory
#   - Vercel project connected to GitHub

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

TARGET="${1:-production}"
ENV_FILE="$PROJECT_ROOT/.env.local"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

check_prerequisites() {
  log_info "Checking prerequisites..."

  if ! command -v vercel &>/dev/null; then
    log_error "Vercel CLI not found. Install with: npm i -g vercel"
    exit 1
  fi

  if ! command -v node &>/dev/null; then
    log_error "Node.js not found. Install Node.js 20+."
    exit 1
  fi

  local node_version
  node_version="$(node -v | sed 's/v//' | cut -d. -f1)"
  if [ "$node_version" -lt 20 ]; then
    log_error "Node.js 20+ required. Current: $(node -v)"
    exit 1
  fi

  if [ ! -d "$PROJECT_ROOT/.vercel" ]; then
    log_warn "No .vercel/ directory found. Run 'vercel link' first."
    log_info "Running vercel link now..."
    vercel link
  fi

  if [ ! -f "$ENV_FILE" ]; then
    log_warn "No .env.local file found. Creating from .env.example..."
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
      cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
      log_warn "Edit $ENV_FILE with your actual values before deploying."
    else
      log_error "No .env.example found either. Cannot create .env.local."
      exit 1
    fi
  fi

  log_ok "Prerequisites check passed."
}

run_checks() {
  log_info "Running pre-deployment checks..."

  # Check if working tree is clean
  if ! git -C "$PROJECT_ROOT" diff --quiet 2>/dev/null; then
    log_warn "Working tree has uncommitted changes."
    log_warn "These changes will NOT be included in the deployment."
  fi

  # Lint check
  log_info "Running ESLint..."
  if npm run lint 2>&1 | tail -5; then
    log_ok "Lint passed."
  else
    log_error "Lint check failed. Fix errors before deploying."
    exit 1
  fi

  # Type check
  log_info "Running TypeScript type check..."
  if npx tsc --noEmit 2>&1 | tail -5; then
    log_ok "Type check passed."
  else
    log_error "Type check failed."
    exit 1
  fi

  # Build check (local)
  log_info "Running production build..."
  if npm run build 2>&1 | tail -10; then
    log_ok "Build passed."
  else
    log_error "Build failed."
    exit 1
  fi
}

deploy_production() {
  log_info "Deploying to PRODUCTION..."
  vercel deploy --prod --yes
  log_ok "Production deployment complete."
}

deploy_preview() {
  log_info "Deploying PREVIEW..."
  vercel deploy --yes
  log_ok "Preview deployment complete."
}

deploy_staging() {
  log_info "Deploying to STAGING..."
  vercel deploy --yes --target staging
  log_ok "Staging deployment complete."
}

pull_env() {
  log_info "Pulling environment variables from Vercel..."
  vercel env pull "$ENV_FILE"
  log_ok "Environment variables pulled to $ENV_FILE"
}

list_env() {
  log_info "Listing Vercel environment variables..."
  vercel env ls
}

setup_env() {
  log_info "Setting up environment variables on Vercel..."
  log_info "This will prompt you for each variable."

  local env_vars=(
    "FANVUE_CLIENT_ID"
    "FANVUE_CLIENT_SECRET"
    "FANVUE_REDIRECT_URI"
  )

  for var in "${env_vars[@]}"; do
    log_info "Setting $var..."
    vercel env add "$var" production preview development
  done

  log_ok "Environment variables configured."
  log_warn "Remember to also set optional vars: KV_REST_API_URL, KV_REST_API_TOKEN, GITHUB_TOKEN, GITHUB_REPO, FANVUE_WEBHOOK_SECRET"
}

print_usage() {
  echo "Fanvue Dashboard — Deployment Helper"
  echo ""
  echo "Usage: $0 <command>"
  echo ""
  echo "Commands:"
  echo "  production   Deploy to production (default)"
  echo "  preview      Deploy preview URL"
  echo "  staging      Deploy to staging environment"
  echo "  checks       Run pre-deployment checks only"
  echo "  env:pull     Pull environment variables from Vercel"
  echo "  env:list     List Vercel environment variables"
  echo "  env:setup    Interactive environment variable setup"
  echo "  help         Show this help message"
}

main() {
  cd "$PROJECT_ROOT"

  case "$TARGET" in
    production|prod)
      check_prerequisites
      run_checks
      deploy_production
      ;;
    preview)
      check_prerequisites
      run_checks
      deploy_preview
      ;;
    staging)
      check_prerequisites
      run_checks
      deploy_staging
      ;;
    checks)
      run_checks
      ;;
    env:pull)
      pull_env
      ;;
    env:list)
      list_env
      ;;
    env:setup)
      setup_env
      ;;
    help|--help|-h)
      print_usage
      ;;
    *)
      log_error "Unknown command: $TARGET"
      print_usage
      exit 1
      ;;
  esac
}

main "$@"
