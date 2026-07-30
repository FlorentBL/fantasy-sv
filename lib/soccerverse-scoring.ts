export type SoccerverseMatchEvent = {
  match_event_id: number;
  event_type: string;
  player_id: number;
  club_id: number;
  time: number;
  goal_type: string | null;
};

export type SoccerverseCommentaryEvent = {
  comm_sub_event_id: number;
  category: string;
  player_one_id: number | null;
  comm_event_id: number;
  time: number;
};

export type SoccerversePlayerTiming = {
  time_started: number;
  time_finished: number;
  red_cards: number;
  yellowred_cards: number;
};

function increment(map: Map<number, number>, playerId: number | null, amount = 1) {
  if (playerId == null) return;
  map.set(playerId, (map.get(playerId) || 0) + amount);
}

export function completedGoals(events: SoccerverseMatchEvent[]) {
  const cancelled = new Map<string, number>();
  for (const event of events) {
    if (event.event_type !== "GOALCANCELLED") continue;
    const key = `${event.player_id}:${event.club_id}:${event.time}`;
    cancelled.set(key, (cancelled.get(key) || 0) + 1);
  }
  return events.filter((event) => {
    if (event.event_type !== "GOAL") return false;
    const key = `${event.player_id}:${event.club_id}:${event.time}`;
    const remaining = cancelled.get(key) || 0;
    if (remaining === 0) return true;
    cancelled.set(key, remaining - 1);
    return false;
  });
}

export function specialEventsByPlayer(
  goals: SoccerverseMatchEvent[],
  commentary: SoccerverseCommentaryEvent[],
) {
  const penaltyGoals = new Map<number, number>();
  const penaltySaves = new Map<number, number>();
  const penaltyMisses = new Map<number, number>();
  const ownGoals = new Map<number, number>();
  const commentaryGroups = new Map<number, SoccerverseCommentaryEvent[]>();
  for (const event of commentary) {
    const group = commentaryGroups.get(event.comm_event_id) || [];
    group.push(event);
    commentaryGroups.set(event.comm_event_id, group);
  }

  for (const group of commentaryGroups.values()) {
    const penalty = group.find((event) => event.category === "PENALTY");
    if (!penalty) continue;
    const save = group.find((event) => event.category === "SAVE");
    const goal = group.some((event) => event.category === "GOAL")
      && !group.some((event) => event.category === "GOALCANCELLED");
    if (save || !goal) {
      increment(penaltyMisses, penalty.player_one_id);
      increment(penaltySaves, save?.player_one_id ?? null);
    } else {
      increment(penaltyGoals, penalty.player_one_id);
    }
  }

  for (const event of goals) {
    const goalType = event.goal_type?.replaceAll(/[^A-Z]/gi, "").toUpperCase() || "";
    if (goalType.includes("OWNGOAL")) increment(ownGoals, event.player_id);
  }
  return { penaltyGoals, penaltySaves, penaltyMisses, ownGoals };
}

export function goalsConcededWhilePlaying(
  player: SoccerversePlayerTiming,
  opponentClubId: number,
  goals: SoccerverseMatchEvent[],
) {
  const end = player.red_cards > 0 || player.yellowred_cards > 0 ? 90 : player.time_finished;
  return goals.filter((goal) => {
    if (goal.club_id !== opponentClubId || goal.time < player.time_started) return false;
    return end >= 90 ? goal.time <= end : goal.time < end;
  }).length;
}
