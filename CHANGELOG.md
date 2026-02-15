# Changelog

## [1.0.0] - 2026-02-15

### Added

- `analyze` command — Aggregate KPIs (CTR, CVR, ACOS, ROAS) from Amazon Ads bulk sheet exports
- `summary` command — Campaign structure overview with layer-level aggregation
- `cpc-report` command — CPC bid optimization report with optional SEO ranking integration
- `promotion-report` command — Auto-to-Manual promotion candidates and negative keyword suggestions
- `seo-report` command — SEO ranking vs ad keyword integrated report
- Campaign layer classification (L0-L4) with configurable policy
- SEO ranking integration via SQLite database (A_rank compatible)
- Support for both Excel (.xlsx) and CSV input files
- Wildcard pattern input file matching
- Environment variable based configuration
- Japanese header support (JP/EN bilingual header mapping)
