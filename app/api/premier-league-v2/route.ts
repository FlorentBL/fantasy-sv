import { NextResponse } from "next/server";
import { getLeagueMarket } from "@/lib/soccerverse-market";

export const runtime = "edge";

export async function GET() {
  try {
    const market = await getLeagueMarket("ENG");
    return NextResponse.json(market, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Données Soccerverse indisponibles.";
    return NextResponse.json({ error: message }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
