# Fantasy SV

Fantasy SV is a full-season Premier League fantasy football game powered by live Soccerverse data.

[Play Fantasy SV](https://fantasy-sv.flobl.workers.dev/)

## Game features

- England's Soccerverse Premier League
- 100-credit squad budget
- 2 goalkeepers, 5 defenders, 5 midfielders and 3 forwards
- Maximum three players per club
- Rating-based, position-normalized pricing
- 38 Soccerverse gameweeks with live deadlines and fixtures
- Starting XI, ordered bench, captain and vice-captain
- Points from minutes, goals, assists, clean sheets, saves, cards, defensive actions and bonuses
- Automatic substitutions and captain fallback
- One free transfer per gameweek, bankable up to five, then four points per extra transfer
- Wildcard, Free Hit, Bench Boost and Triple Captain in each half-season
- Overall ranking, gameweek history and private classic mini-leagues
- Email/password accounts, with optional Discord OAuth
- A user preference between Soccerverse's standard data and the El Rincón community pack
- Server-side squad persistence for signed-in players and a local draft for visitors
- French, English, Italian, Spanish, German and Portuguese

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

The Worker runs a scheduled Soccerverse synchronization every 15 minutes. It refreshes the calendar, imports completed match statistics and settles fantasy scores.

To enable Discord, create an OAuth application with this redirect URL:

```text
https://fantasy-sv.flobl.workers.dev/api/auth/callback/discord
```

Then add `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` with `wrangler secret put`.

## Contributing

Fantasy SV is built in public. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.
