# Security Policy

## Supported Versions

The active default branch is supported for security updates.

## Reporting a Vulnerability

Please report vulnerabilities privately and do not open a public issue.

- Contact: open a private security advisory in GitHub Security for this repository.
- Include: impact, reproduction steps, affected routes/files, and suggested mitigation.
- Response target: initial triage within 72 hours.

## Secret Handling

- Never commit credentials, API keys, or tokens.
- Use `.env.local` for local-only configuration.
- Rotate any key immediately if exposure is suspected.

## Dependency Hygiene

- Run `npm run audit:prod` regularly.
- Keep lockfiles updated in PRs that modify dependencies.
