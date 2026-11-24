const prices = Object.freeze({ wemember:15, sorriest:20, barara:30 });
const timestamp = () => Math.floor(Date.now() / 1000);
const availableGrants = `
  SELECT g.id, g.created_at, g.expires_at, g.amount - COALESCE((
    SELECT sum(a.amount) FROM token_allocations a JOIN game_entries e ON e.id=a.entry_id
    WHERE a.grant_id=g.id AND e.state IN ('reserved','spent')
  ),0) AS remaining FROM token_grants g WHERE g.user_id=? AND (g.expires_at IS NULL OR g.expires_at>?)
`;

export async function balance(db, userId, now=timestamp()) {
  const row = await db.prepare('SELECT COALESCE(sum(remaining),0) AS total FROM ('+availableGrants+')')
    .bind(userId,now).first();
  return row.total;
}

export async function reserveEntry(db, {userId, game, roundId}, now=timestamp()) {
  if (!Object.hasOwn(prices,game) || typeof roundId!=='string' || !/^[a-f0-9-]{36}$/.test(roundId)) throw new Error('Invalid game round');
  const id = crypto.randomUUID();
  const date = new Date(now*1000).toISOString().slice(0,10);
  const free = game==='wemember' ? date : null;
  const reserve = db.prepare(`
    WITH free AS (
      SELECT ? AS day WHERE ? IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM game_entries WHERE user_id=? AND game=? AND free_day=? AND state!='released'
      )
    ), eligible AS (
      SELECT (SELECT day FROM free) AS day,
        CASE WHEN EXISTS(SELECT 1 FROM free) THEN 0 ELSE ? END AS cost
    )
    INSERT INTO game_entries (id,user_id,game,round_id,cost,free_day,state,created_at)
    SELECT ?,?,?,?,cost,day,'reserved',? FROM eligible
    WHERE cost=0 OR cost<=(SELECT COALESCE(sum(remaining),0) FROM (`+availableGrants+`))
    ON CONFLICT(user_id,game,round_id) DO NOTHING
  `).bind(free,free,userId,game,free,prices[game],
    id,userId,game,roundId,now,userId,now);
  const allocate = db.prepare(`
    WITH grants AS (`+availableGrants+`), ranked AS (
      SELECT id,remaining,COALESCE(sum(remaining) OVER(
        ORDER BY expires_at IS NULL, expires_at, created_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),0) AS used FROM grants WHERE remaining>0
    )
    INSERT INTO token_allocations(entry_id,grant_id,amount)
    SELECT e.id,r.id,min(r.remaining,e.cost-r.used)
    FROM game_entries e CROSS JOIN ranked r WHERE e.id=? AND r.used<e.cost
  `).bind(userId,now,id);
  await db.batch([reserve,allocate]);
  return db.prepare('SELECT id,state,cost,free_day FROM game_entries WHERE user_id=? AND game=? AND round_id=?')
    .bind(userId,game,roundId).first();
}

export async function settleRound(db, game, roundId, outcome, userId) {
  if (!Object.hasOwn(prices,game) || !['spent','released'].includes(outcome)) throw new Error('Invalid settlement');
  return db.prepare("UPDATE game_entries SET state=? WHERE game=? AND round_id=? AND state='reserved' AND (? IS NULL OR user_id=?)")
    .bind(outcome,game,roundId,userId ?? null,userId ?? null).run();
}
