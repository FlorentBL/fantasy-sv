# Fantasy SV

Fantasy SV is a Premier League fantasy football MVP powered by live Soccerverse data.

## MVP

- England's Soccerverse Premier League
- 100-credit squad budget
- 2 goalkeepers, 5 defenders, 5 midfielders and 3 forwards
- Maximum three players per club
- Rating-based, position-normalized pricing
- Email/password accounts, with optional Discord OAuth
- A user preference between Soccerverse's standard data and the El Rincón community pack
- One locally saved Premier League squad

## Development

```bash
npm install
npm run db:migrate:local
npm run dev
```

Copy `.dev.vars.example` to `.dev.vars` and replace `BETTER_AUTH_SECRET` with a random value of at least 32 characters. Discord is optional in development.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run security:audit
```

## Cloudflare

```bash
npm run db:migrate:remote
npx wrangler secret put BETTER_AUTH_SECRET
npm run deploy
```

To enable Discord, create an OAuth application with this redirect URL:

```text
https://fantasy-sv.flobl.workers.dev/api/auth/callback/discord
```

Then add `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` with `wrangler secret put`.
