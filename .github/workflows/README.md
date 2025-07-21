# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the awake-lock library.

## Available Workflows

### 🔄 CI (`main.yml`)
**Trigger:** Push to `main`/`master`/`develop`, Pull Requests  
**Purpose:** Comprehensive testing and quality assurance

**Jobs:**
- **Test Matrix:** Node.js 16.x, 18.x, 20.x on Ubuntu
- **Quality Checks:** Linting, formatting, type checking
- **Build Verification:** All formats (ESM, CJS, UMD)
- **Bundle Size:** Ensures UMD bundle stays under 50KB
- **Coverage:** Uploads to Codecov (Node 18.x only)

### 📦 Publish (`publish.yml`)
**Trigger:** GitHub releases, Manual dispatch  
**Purpose:** Automated NPM publishing with version management

**Features:**
- Version bumping (patch/minor/major)
- Full test suite execution before publish
- Build verification
- NPM registry publication
- GitHub Packages publication
- Automatic GitHub release creation

### 🔄 Update Dependencies (`update-dependencies.yml`)
**Trigger:** Weekly schedule (Mondays 9 AM UTC), Manual dispatch  
**Purpose:** Automated dependency updates

**Process:**
- Updates all dependencies to latest versions
- Runs full test suite
- Creates pull request if updates pass
- Automated PR with detailed change summary

## Workflow Status

[![CI](https://github.com/Emmanuelnoi/awake-lock/workflows/CI/badge.svg)](https://github.com/Emmanuelnoi/awake-lock/actions)

## Setup Requirements

### NPM Publishing
Add these secrets to your GitHub repository:
- `NPM_TOKEN`: Your NPM authentication token

### Coverage Reports (Optional)
- `CODECOV_TOKEN`: Codecov upload token

### GitHub Token
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Usage

### Manual Publishing
1. Go to Actions → Publish to NPM
2. Click "Run workflow"
3. Select version type (patch/minor/major)
4. Workflow will:
   - Bump version
   - Run tests
   - Build project
   - Publish to NPM
   - Create GitHub release

### Manual Dependency Updates
1. Go to Actions → Update Dependencies  
2. Click "Run workflow"
3. Review and merge the created PR

## Optimization Features

- **Parallel Execution:** Test matrix runs in parallel
- **Caching:** Efficient pnpm cache management
- **Multi-platform:** Testing on Ubuntu, Windows, macOS
- **Security:** Automated vulnerability scanning
- **Bundle Size Monitoring:** Prevents bundle bloat
- **Type Safety:** Comprehensive TypeScript checking

## Workflow Files
- `main.yml` - Primary CI/CD pipeline
- `publish.yml` - NPM publishing automation
- `update-dependencies.yml` - Dependency management