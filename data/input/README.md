# Input Data Directory

Place your Amazon Ads bulk sheet files here for analysis.

## Supported Formats

- Excel (`.xlsx`) — Amazon Ads bulk sheet export
- CSV (`.csv`) — comma-separated or tab-separated

## Usage

```bash
# Analyze all Excel files in this directory
aads analyze --input "data/input/*.xlsx"

# Generate bulk sheet from analysis
aads generate --input "data/input/*.xlsx" --output output/bulk-update.xlsx

# Specific file
aads analyze --input "data/input/my-report.csv"
```

## Important

Files in this directory are **excluded from git** (via `.gitignore`) to prevent accidental commits of sensitive campaign data. Only this README is tracked.
