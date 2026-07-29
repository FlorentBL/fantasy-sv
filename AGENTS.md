# Fantasy SV - Repository Instructions

## Canonical delivery target

- Production is hosted on Cloudflare Workers through `wrangler.jsonc`.
- The canonical Worker name is `fantasy-sv`.
- Do not deploy to Vercel, Sites, or another host unless explicitly requested.

## Definition of done

1. Typecheck, lint, unit tests, build and security audit pass.
2. The finished source is committed when a Git repository exists.
3. Deployment is run with `npm run deploy`.
4. The production Worker URL responds successfully.
5. Squad building is verified on desktop and mobile.

## Product rules

- A user can build one Premier League squad.
- Every squad has a 100-credit budget and contains 2 GK, 5 DEF, 5 MID and 3 FWD.
- A squad can include no more than three players from one club.
- Fantasy positions and prices are frozen for the duration of a Soccerverse season.
- Fantasy credits are separate from SVC and Influence.
