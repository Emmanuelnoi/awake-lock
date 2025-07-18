# Contributing to AwakeLock

Thank you for your interest in contributing to AwakeLock! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Issue Guidelines](#issue-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js 14+ (recommended: latest LTS)
- pnpm (recommended package manager)
- Git
- A modern browser for testing

### First-time Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/awake-lock.git
   cd awake-lock
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/Emmanuelnoi/awake-lock.git
   ```
4. **Install dependencies**:
   ```bash
   pnpm install
   ```
5. **Run the build** to verify setup:
   ```bash
   pnpm run build
   ```
6. **Run tests** to ensure everything works:
   ```bash
   pnpm test
   ```

## Development Setup

### Project Structure

```
src/
├── WakeLock.ts              # Main library class
├── PermissionManager.ts     # Permission handling
├── PerformanceMonitor.ts    # Performance monitoring
├── strategies/              # Fallback strategies
│   ├── ScreenWakeLockStrategy.ts
│   ├── VideoElementStrategy.ts
│   ├── AudioContextStrategy.ts
│   └── TimerStrategy.ts
├── frameworks/              # Framework integrations
│   ├── react.tsx
│   ├── vue.ts
│   └── angular.ts
├── utils/                   # Utility functions
│   ├── EventEmitter.ts
│   └── helpers.ts
├── types.ts                 # TypeScript definitions
├── index.ts                 # Main entry point
└── index.core.ts           # Core-only entry point
```

### Available Scripts

```bash
# Development
pnpm run dev              # Watch mode development build
pnpm run build            # Production build
pnpm run clean            # Clean build artifacts

# Testing
pnpm test                 # Run all tests
pnpm run test:watch       # Run tests in watch mode
pnpm run test:ui          # Run tests with UI

# Code Quality
pnpm run lint             # Run ESLint
pnpm run lint:fix         # Fix ESLint issues
pnpm run typecheck        # TypeScript type checking
pnpm run format           # Format code with Prettier
pnpm run format:check     # Check code formatting
```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test improvements

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the [code style guidelines](#code-style)

3. **Add tests** for new functionality

4. **Run the development checks**:
   ```bash
   pnpm run build
   pnpm test
   pnpm run lint
   pnpm run typecheck
   ```

5. **Commit your changes** with a descriptive message:
   ```bash
   git add .
   git commit -m "feat: add new strategy for X"
   ```

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request** on GitHub

### Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example:
```
feat(strategies): add WebRTC strategy for video calls

Adds a new fallback strategy using WebRTC to maintain
wake lock during video calls when other methods fail.

Closes #123
```

## Testing

### Test Structure

Tests are located in the `tests/` directory and use Vitest:

```bash
tests/
├── WakeLock.test.ts         # Main library tests
├── strategies/              # Strategy-specific tests
├── frameworks/              # Framework integration tests
└── setup.ts                 # Test setup and mocks
```

### Writing Tests

1. **Unit tests** for individual components
2. **Integration tests** for strategy coordination
3. **Framework tests** for React/Vue/Angular integrations
4. **Browser compatibility tests** for different environments

### Test Guidelines

- Use descriptive test names
- Test both success and error cases
- Mock external dependencies (DOM APIs, browser features)
- Maintain high test coverage (current: 25/25 passing)

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test WakeLock.test.ts

# Run with coverage
pnpm test --coverage

# Run in watch mode
pnpm run test:watch
```

## Code Style

### TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer explicit return types for public methods
- Use interfaces for object types
- Prefer `const` over `let` when possible
- Use meaningful variable and function names

### Code Formatting

- We use Prettier for consistent formatting
- ESLint for code quality
- 2-space indentation
- Single quotes for strings
- Trailing commas in multiline structures

### Documentation

- Add JSDoc comments for public APIs
- Include usage examples in complex functions
- Update README.md for user-facing changes
- Update ARCHITECTURE.md for internal changes

## Submitting Changes

### Issue Guidelines

Before submitting an issue:

1. **Search existing issues** to avoid duplicates
2. **Use issue templates** when available
3. **Provide clear reproduction steps** for bugs
4. **Include environment information** (browser, OS, version)

### Bug Reports

Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser/environment details
- Code examples or screenshots

### Feature Requests

Include:
- Clear use case description
- Proposed API or implementation
- Alternative solutions considered
- Impact on existing functionality

### Pull Request Guidelines

1. **Link to related issue** if applicable
2. **Provide clear description** of changes
3. **Include tests** for new functionality
4. **Update documentation** as needed
5. **Ensure CI passes** (tests, linting, build)
6. **Keep PRs focused** - one feature/fix per PR
7. **Be responsive** to review feedback

### Pull Request Checklist

- [ ] Tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm run build`)
- [ ] Linting passes (`pnpm run lint`)
- [ ] Type checking passes (`pnpm run typecheck`)
- [ ] Documentation updated (if needed)
- [ ] CHANGELOG.md updated (for releases)
- [ ] Commit messages follow convention
- [ ] PR description is clear and complete

## Extending the Library

### Adding New Strategies

1. **Create strategy file** in `src/strategies/`
2. **Implement FallbackStrategy interface**:
   ```typescript
   export class CustomStrategy implements FallbackStrategy {
     readonly name = 'custom-strategy';
     readonly priority = 5;
     
     isSupported(): boolean {
       // Support detection logic
     }
     
     async request(type: WakeLockType): Promise<WakeLockSentinel> {
       // Implementation
     }
   }
   ```
3. **Add to default strategies** in `WakeLock.ts`
4. **Write comprehensive tests**
5. **Update documentation**

### Adding Framework Integrations

1. **Create framework file** in `src/frameworks/`
2. **Use core WakeLock class**
3. **Follow framework patterns** (hooks, composables, services)
4. **Handle framework lifecycle** properly
5. **Add to main exports** in `index.ts`
6. **Update peer dependencies** if needed

## Release Process

### Version Bumping

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Release Steps

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with release notes
3. **Run full test suite**: `pnpm test`
4. **Build library**: `pnpm run build`
5. **Create release commit**: `git commit -m "chore: release v1.x.x"`
6. **Create git tag**: `git tag v1.x.x`
7. **Push changes**: `git push origin master --tags`
8. **Publish to npm**: `pnpm publish`

## Getting Help

### Resources

- [API Documentation](README.md)
- [Issue Tracker](https://github.com/Emmanuelnoi/awake-lock/issues)
- [Discussions](https://github.com/Emmanuelnoi/awake-lock/discussions)

### Communication

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and ideas
- **Pull Request Reviews** - Code feedback and collaboration

---

Thank you for contributing to AwakeLock! Your efforts help make web development better for everyone. 🙏