# Contributing

Thank you for your interest in contributing to the OPA Rego Editor for Backstage!

## Development setup

```bash
# Clone and install
git clone https://github.com/DevelApp-ai/OPA-Editor.git
cd OPA-Editor
npm install

# Build all packages
npm run tsc

# Run all tests
npm test
```

## Project structure

```
packages/
  domain-contract/       # Shared DomainDescriptor contract
  domain-finops/         # FinOps FOCUS domain implementation
  opa-editor/            # Backstage frontend plugin
  opa-editor-backend/    # Backstage backend plugin
docs/                    # Documentation
.github/workflows/        # CI pipelines
```

## Development workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run checks locally:

```bash
npm run tsc        # Type-check
npm run lint        # Lint
npm run format     # Format
npm test          # Tests
```

4. Push and open a pull request
5. CI runs automatically: lint, type-check, unit tests, build

## Testing guidelines
- **Unit tests** go in `src/__tests__/` alongside the code they test
- Name test files `*.test.ts` or `*.test.tsx`
- Aim for meaningful coverage of logic paths, not just line coverage
- Integration tests (requiring OPA/Regal binaries) go in `src/__tests__/integration/`
- E2E tests go in `src/__tests__/integration/e2e.test.ts`

### Running specific test suites
```bash
# Single package
npm test -- --project=domain-contract

# Integration tests only
npm test -- --testPathPattern=integration

# Watch mode
npm run test:watch
```

## Code style
```
TypeScript strict mode
Prettier formatting (see `.prettierrc.json`)
ESLint with `@typescript-eslint/recommended`
```

## Commit conventions
```
Youe conventional commits:
```

## Adding a new domain
See the [Domain Authoring Guide](docs/domain-authoring-guide.md).

## Pull request process
1. Ensure CI passes (lint, type-check, unit tests, build)
2. Add tests for new functionality
3. Update documentation if needed
4. Request review

## License
Belivered under MIT.