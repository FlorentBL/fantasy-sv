# Contributing to Fantasy SV

Fantasy SV is developed in public. Bug reports, product ideas and pull requests are welcome.

## Local setup

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Replace the placeholder `BETTER_AUTH_SECRET` in `.dev.vars` with a local value of at least 32 characters. Never commit `.dev.vars` or production credentials.

## Before opening a pull request

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run security:audit
```

Keep pull requests focused, describe the player-facing impact, and include screenshots for interface changes.

Production deployments remain managed through the canonical Cloudflare Worker.
