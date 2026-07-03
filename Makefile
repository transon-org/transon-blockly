# Makefile — Transon Visual Editor (transon-blockly)
#
# Convenience wrapper over the pnpm/Turborepo workspace and the deterministic
# harness gates. Nothing here is a source of truth: it only shells out to the
# same scripts CI runs (.github/workflows/agentic-checks.yml) and the package
# scripts (package.json / packages/*/package.json). Run `make` for the menu.

# Tools (override on the CLI, e.g. `make PYTHON=python test`).
PNPM   ?= pnpm
PYTHON ?= python3

# Reference host = the runnable editor demo (in-browser Pyodide engine, AD-025).
DEMO_PKG ?= @transon/reference-host

.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nTranson Visual Editor — make targets\n\n"} \
		/^##@/ {printf "\n\033[1m%s\033[0m\n", substr($$0, 5); next} \
		/^[a-zA-Z0-9_-]+:.*##/ {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

##@ Setup
.PHONY: install
install: ## Install all workspace dependencies (pnpm)
	$(PNPM) install

##@ Demo
# The reference host consumes the packages from their built `dist/` (as a real embedder would), so
# a stale build would serve stale code — build first so the demo always reflects current source.
.PHONY: demo
demo: build ## Run the editor demo (reference host, Vite dev server; builds packages first)
	$(PNPM) --filter $(DEMO_PKG) dev

##@ Build & types
.PHONY: build
build: ## Build every package (turbo run build)
	$(PNPM) run build

.PHONY: typecheck
typecheck: ## Type-check every package (tsc --noEmit)
	$(PNPM) run typecheck

##@ Tests
.PHONY: test
test: ## Run the full test suite (turbo run test)
	$(PNPM) run test

.PHONY: test-watch
test-watch: ## Run the workspace tests in watch mode (root Vitest)
	$(PNPM) exec vitest

.PHONY: test-core
test-core: ## Test only @transon/editor-core
	$(PNPM) --filter @transon/editor-core test

.PHONY: test-adapter
test-adapter: ## Test only the Node→Python round-trip adapter
	$(PNPM) --filter @transon/engine-node-adapter test

.PHONY: test-host
test-host: ## Test only the reference host (demo)
	$(PNPM) --filter $(DEMO_PKG) test

.PHONY: test-coverage
test-coverage: ## Run tests with coverage (needs @vitest/coverage-v8)
	@if [ -d node_modules/@vitest/coverage-v8 ]; then \
		$(PNPM) exec vitest run --coverage; \
	else \
		echo "coverage provider missing — install with:"; \
		echo "  $(PNPM) add -Dw @vitest/coverage-v8"; \
		exit 1; \
	fi

##@ Gates (mirror .github/workflows/agentic-checks.yml)
.PHONY: gates
gates: traceability links evals parity snapshot maturity check-codec check-presentation check-runtime-size ## Run all deterministic harness gates
	@echo "✓ all gates passed"

.PHONY: traceability
traceability: ## Requirement-ID consistency (no dead IDs; done rows cite a test)
	$(PYTHON) harness/scripts/check_traceability.py

.PHONY: links
links: ## Every relative Markdown link/anchor resolves
	$(PYTHON) harness/scripts/check_links.py

.PHONY: evals
evals: ## Harness golden-path evals (maker≠checker, routing, parity)
	$(PYTHON) harness/evals/run_evals.py

.PHONY: parity
parity: ## Engine/spec drift check (self-skips until the engine is pinned)
	$(PYTHON) harness/scripts/check_engine_parity.py

.PHONY: snapshot
snapshot: ## Committed engine-metadata snapshot is present and not drifted
	$(PYTHON) harness/scripts/update_memory.py --check

.PHONY: maturity
maturity: ## Agentic-maturity ratchet (no regression below baseline)
	$(PYTHON) harness/scripts/check_maturity.py --check

.PHONY: check-codec
check-codec: ## No hand-written codec↔workspace mapping (FR-126, AD-032)
	$(PYTHON) harness/scripts/check_no_codec_mapping.py

.PHONY: check-presentation
check-presentation: ## Editor presentation is data, not TS literals (FR-127)
	$(PYTHON) harness/scripts/check_presentation.py

.PHONY: check-runtime-size
check-runtime-size: ## Blockly behavior runtime stays finite (NFR-046)
	$(PYTHON) harness/scripts/check_behavior_runtime_size.py

##@ Verification
.PHONY: check
check: typecheck test gates ## Full local pre-merge verification (types + tests + gates)
	@echo "✓ typecheck + tests + gates all green"

##@ Metrics
.PHONY: cloc
cloc: ## Count lines of code (respects .gitignore via git)
	@command -v cloc >/dev/null 2>&1 || { \
		echo "cloc not installed — install with: brew install cloc"; exit 1; }
	cloc --vcs=git .

##@ Maintenance
.PHONY: memory
memory: ## Refresh working memory (current-state header + metadata snapshot)
	$(PYTHON) harness/scripts/update_memory.py --state
	$(PYTHON) harness/scripts/update_memory.py --snapshot

.PHONY: clean
clean: ## Remove build output and Turbo cache (dist/, .turbo/)
	find . -type d \( -name dist -o -name .turbo \) -not -path '*/node_modules/*' -prune -exec rm -rf {} +
	@echo "✓ cleaned dist/ and .turbo/"
