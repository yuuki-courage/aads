# aads

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

CLI tool for analyzing Amazon Ads Sponsored Products campaign performance.

Reads Amazon Ads bulk sheet exports (Excel/CSV) and generates actionable optimization reports — CPC bid recommendations, auto-to-manual promotion candidates, negative keyword suggestions, and SEO ranking integration.

## Features

| Command | Description |
|---------|-------------|
| `analyze` | Aggregate KPIs (CTR, CVR, ACOS, ROAS) from bulk sheet data |
| `summary` | Campaign structure overview with layer-level aggregation |
| `cpc-report` | CPC bid optimization report with optional SEO ranking integration |
| `promotion-report` | Auto-to-Manual promotion candidates + negative keyword suggestions |
| `seo-report` | SEO organic ranking vs ad keyword integrated report |
| `generate` | Generate Amazon Ads bulk sheet from analysis results |

## Installation

```bash
npm install -g aads-cli
```

Or use without installing:

```bash
npx aads --help
```

## Quick Start

```bash
# Analyze a bulk sheet export
aads analyze --input "bulk-*.xlsx"

# Generate campaign structure summary
aads summary --input "bulk-*.xlsx"

# Generate CPC optimization report
aads cpc-report --input "bulk-*.xlsx" --output cpc-report.xlsx

# Generate promotion report
aads promotion-report --input "bulk-*.xlsx" --output promotion.xlsx

# Generate SEO-integrated report
aads seo-report --input "bulk-*.xlsx" --ranking-db ranking.db

# Generate bulk sheet for uploading to Amazon Ads
aads generate --input "bulk-*.xlsx" --output bulk-update.xlsx

# Generate only specific blocks (e.g., CPC + Negative keywords)
aads generate --input "bulk-*.xlsx" --output bulk-update.xlsx --blocks 2,4
```

## Commands

### `analyze`

Aggregates campaign KPIs from Amazon Ads bulk sheet exports.

```bash
aads analyze --input <pattern> [--layer-policy <file>]
```

| Option | Description |
|--------|-------------|
| `--input <pattern>` | Input Excel/CSV path or wildcard pattern (required) |
| `--layer-policy <file>` | Campaign layer policy JSON path |

### `summary`

Displays campaign structure with ad group details and layer classification.

```bash
aads summary --input <pattern> [--layer-policy <file>]
```

### `cpc-report`

Generates CPC bid optimization recommendations as an Excel report.

```bash
aads cpc-report --input <pattern> --output <file> [--ranking-db <path>]
```

| Option | Description |
|--------|-------------|
| `--input <pattern>` | Input Excel/CSV path or wildcard pattern (required) |
| `--output <file>` | Output xlsx path (required) |
| `--ranking-db <path>` | A_rank SQLite DB path for SEO-based CPC adjustment |

### `promotion-report`

Identifies auto campaign search terms ready for manual campaign promotion and suggests negative keywords for wasteful terms.

```bash
aads promotion-report --input <pattern> --output <file>
```

### `seo-report`

Cross-references ad keywords with organic SEO ranking data to identify opportunities for bid reduction where organic rankings are strong.

```bash
aads seo-report --input <pattern> --ranking-db <path> [--output <file>] [--format <type>]
```

| Option | Description |
|--------|-------------|
| `--input <pattern>` | Input Excel/CSV path or wildcard pattern (required) |
| `--ranking-db <path>` | A_rank SQLite DB path (required) |
| `--output <file>` | Output file path |
| `--format <type>` | `console` \| `json` \| `xlsx` (default: `console`) |

### `generate`

Generates an Amazon Ads bulk sheet (V2.10 format, 27 columns) from analysis results. Runs the full analyze pipeline, then applies selected optimization blocks to produce rows ready for upload.

```bash
aads generate --input <pattern> --output <file> [--blocks <list>]
```

| Option | Description |
|--------|-------------|
| `--input <pattern>` | Input Excel/CSV path or wildcard pattern (required) |
| `--output <file>` | Output xlsx path (required) |
| `--blocks <list>` | Comma-separated block numbers to run (default: all) |

**Available Blocks:**

| Block | Name | Description |
|-------|------|-------------|
| 1 | Budget | Campaign daily budget adjustments |
| 2 | CPC | Keyword bid updates based on ACOS optimization |
| 3 | Promotion | Auto-to-Manual keyword promotion (create in manual campaign) |
| 3.5 | Negative Sync | Add negative keywords in auto campaign for promoted terms |
| 4 | Negative | Negative keywords for wasteful search terms |
| 5 | Placement | Placement bid modifier adjustments (Top of Search / Product Pages) |

## Configuration

Configuration is done via environment variables (or a `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `TARGET_ACOS` | `0.25` | Target ACOS for CPC optimization |
| `MIN_CLICKS_CPC` | `5` | Minimum clicks for CPC recommendation |
| `MIN_CLICKS_PROMOTION` | `5` | Minimum clicks for promotion candidate |
| `MIN_CVR_PROMOTION` | `0.03` | Minimum CVR for promotion candidate |
| `NEGATIVE_ACOS_THRESHOLD` | `0.4` | ACOS threshold for negative keyword suggestion |
| `SEO_ENABLED` | `true` | Enable SEO ranking integration |
| `SEO_CPC_CEILING` | `0` | CPC ceiling (0 = auto) |
| `RANKING_DB_PATH` | - | Default path to A_rank SQLite DB |
| `LOG_LEVEL` | `info` | Log level (`debug` \| `info`) |

See [`.env.example`](.env.example) for a complete template.

## SEO Integration

The `cpc-report` and `seo-report` commands can integrate with SEO ranking data stored in a SQLite database.

When an ad keyword has strong organic ranking (positions 1-4), the tool automatically reduces the recommended CPC bid:

| Organic Position | SEO Factor | Bid Reduction |
|-----------------|------------|---------------|
| #1 | 0.50 | -50% |
| #2 | 0.60 | -40% |
| #3 | 0.70 | -30% |
| #4 | 0.80 | -20% |
| #5+ | 1.00 | No change |

### Getting Started with SEO Data

A sample database with dummy data is included for testing:

```bash
aads seo-report --input bulk-sheet.xlsx --ranking-db data/sample-ranking.db
```

To use your own data, create a SQLite database matching the [database schema](docs/seo-database-schema.md). You can populate it from any source — a custom scraper, third-party API, or manual entry.

> **Coming soon**: A companion Chrome extension for automatically collecting Amazon search ranking data will be released as a separate open-source project.

## Campaign Layer Policy

The `analyze` and `summary` commands support campaign layer classification using a JSON policy file:

```bash
aads summary --input "bulk-*.xlsx" --layer-policy data/campaign-layer-policy.json
```

See [`data/campaign-layer-policy.json`](data/campaign-layer-policy.json) for the default policy structure.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

[MIT](LICENSE)
