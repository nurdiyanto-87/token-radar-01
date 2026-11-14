// The token radar's model (comps-1): one sealed snapshot in, one ranked board out.
//
// The board ranks every protocol the snapshot records as pre-token that also
// passes the watchlist's own exclusion rule, mirrored from the ten fields the
// snapshot carries: no token on record, and not a wrapped, staked, bridged or
// exchange product, and not a versioned pool. The watchlist's 40 are the floor;
// the early rows below it and the above-floor rows the list leaves out are the
// radar's own finds. Protocols whose token already trades are set aside with
// the market's own values, never mixed into the ranking.
//
// Implied value is calibrated by the market inside the snapshot itself: for
// each category, the median market-cap-to-TVL ratio of the protocols whose
// token already trades, shrunk toward the global median when the category has
// few live comps, and clamped to a sane band. No protocol name is ever
// special-cased: the same function scores every row.
//
//   multiple     = clamp(shrunk category median mcap/tvl, 0.05, 1.00)
//   growthMult   = 1 + clamp(change_7d, -50, 100) / 100 * 0.5
//   maturityMult = 0.6 + 0.4 * sqrt(min(age_days, 1095) / 1095)
//   breadthMult  = 1 + 0.02 * min(max(chains - 1, 0), 5)
//   implied      = max(1, round(tvl_usd * multiple * growthMult * maturityMult * breadthMult))
//
// Age unknown uses the median age of the rankable set, computed from the
// snapshot; an unreported 7d change is neutral (0). The dashboard states this
// formula, shows every category's comps, and recomputes each row in the page.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_days: number;
  multiple_floor: number;
  multiple_cap: number;
  shrink_prior: number;
  breadth_step: number;
  breadth_max_extra_chains: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.6,
  maturity_days: 1095,
  multiple_floor: 0.05,
  multiple_cap: 1.0,
  shrink_prior: 4,
  breadth_step: 0.02,
  breadth_max_extra_chains: 5,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'comps-1';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** How many excluded pre-token products the Set aside view carries, by TVL. */
export const SET_ASIDE_ROWS = 40;

/** Where a row sits relative to the watchlist floor. */
export type ListKind = 'watchlist' | 'early' | 'above-floor';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm plan's totals: capital at risk, gas across the plan, transactions, weeks. */
export interface PlanTotals {
  capital_usd: number;
  gas_low_usd: number;
  gas_high_usd: number;
  tx_count: number;
  weeks: number;
  hold_days: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  list: ListKind;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    multiple: number;
    multiple_raw: number;
    comp_n: number;
    category_median: number | null;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row, with the farm plan kept structured. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  list: ListKind;
  implied_value_usd: number;
  multiple: number;
  multiple_raw: number;
  comp_n: number;
  category_median: number | null;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  farm: FarmStep[];
  plan: PlanTotals;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl: number | null;
}

/** An excluded pre-token product, set aside with the reason it is not ranked. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  reason: string;
}

/** One category's live comps, as the dashboard's comps table shows them. */
export interface CompRow {
  category: string;
  n: number;
  median: number | null;
  multiple: number;
}

/** Everything the dashboard needs: the board, the live set, the set-aside set, the comps. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  above_floor_size: number;
  live_size: number;
  set_aside_size: number;
  median_age_days: number;
  global_median_multiple: number;
  comps: CompRow[];
  rows: RadarRow[];
  live: LiveRow[];
  set_aside: SetAsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of finite numbers; null when empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Categories the watchlist rule treats as wrapped, staked or bridged products. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** Exchange names the watchlist rule treats as an exchange's own product. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
/** Whole words the watchlist rule treats as a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/**
 * Why a pre-token protocol is NOT ranked, in the watchlist rule's own terms, or
 * null when it passes. The snapshot carries no parent record, so a protocol
 * whose parent another record names cannot be caught here: the rule is
 * mirrored from the ten fields, and the dashboard says so.
 */
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return `category ${p.category}: a wrapped, staked, bridged or exchange product`;
  if (VERSIONED.test(p.name)) return 'versioned name: a pool of another protocol';
  if (WRAPPED_WORD.test(p.name)) return 'name carries wrapped, staked or staking: a wrapped or staked product';
  if (EXCHANGE_PREFIX.test(p.name)) return "name begins with an exchange's name: an exchange product";
  return null;
}

/** Whether a protocol is one the board may rank: pre-token and past the exclusion rule. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && exclusionReason(p) === null;
}

/** The live-token comps: every protocol whose token trades, grouped by category. */
export interface Comps {
  globalMedian: number;
  byCategory: Map<string, { n: number; median: number }>;
}

export function liveComps(snapshot: Snapshot): Comps {
  const ratios: number[] = [];
  const perCategory = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    ratios.push(ratio);
    const key = p.category ?? 'Other';
    const list = perCategory.get(key);
    if (list === undefined) perCategory.set(key, [ratio]);
    else list.push(ratio);
  }
  const globalMedian = median(ratios) ?? 0.25;
  const byCategory = new Map<string, { n: number; median: number }>();
  for (const [key, list] of perCategory) {
    const m = median(list);
    if (m !== null) byCategory.set(key, { n: list.length, median: m });
  }
  return { globalMedian, byCategory };
}

/**
 * A category's valuation multiple: its live comps' median mcap/TVL, shrunk
 * toward the global median (weight n/(n+prior)), then clamped to the band.
 * A category with no live comps takes the global median outright.
 */
export function categoryMultiple(category: string | null, comps: Comps, model: ModelConstants): { multiple: number; raw: number; n: number; catMedian: number | null } {
  const key = category ?? 'Other';
  const entry = comps.byCategory.get(key);
  const n = entry === undefined ? 0 : entry.n;
  const catMedian = entry === undefined ? null : entry.median;
  const weight = n / (n + model.shrink_prior);
  const raw = catMedian === null ? comps.globalMedian : weight * catMedian + (1 - weight) * comps.globalMedian;
  const multiple = Math.min(model.multiple_cap, Math.max(model.multiple_floor, raw));
  return { multiple, raw, n, catMedian };
}

/** The context every row is scored with: the snapshot's date, its comps, its median age. */
export interface ScoreContext {
  asOf: string;
  comps: Comps;
  medianAge: number;
  model: ModelConstants;
}

/** The multipliers and the implied value one protocol gets. */
export function impliedValue(p: SnapshotProtocol, ctx: ScoreContext): {
  implied: number;
  multiple: number;
  multipleRaw: number;
  compN: number;
  catMedian: number | null;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
} {
  const { model } = ctx;
  const age = ageDays(ctx.asOf, p.listed_at);
  const { multiple, raw, n, catMedian } = categoryMultiple(p.category, ctx.comps, model);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? ctx.medianAge;
  const maturityMult = model.maturity_floor + (1 - model.maturity_floor) * Math.sqrt(Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
  const breadthMult = 1 + model.breadth_step * Math.min(Math.max(p.chains.length - 1, 0), model.breadth_max_extra_chains);
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growthMult * maturityMult * breadthMult));
  return { implied, multiple, multipleRaw: raw, compN: n, catMedian, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** Where a row sits relative to the watchlist floor. */
export function listOf(p: SnapshotProtocol, snapshot: Snapshot, watchlist: Set<string>): ListKind {
  if (watchlist.has(p.slug)) return 'watchlist';
  return p.tvl_usd < snapshot.floor_usd ? 'early' : 'above-floor';
}

// ---------------------------------------------------------------- farm plans

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A chain's gas tier: what one transaction on it typically costs the farmer. */
export type GasTier = 'high' | 'medium' | 'low';

const LOW_GAS_CHAINS = new Set([
  'Arbitrum', 'Arbitrum Nova', 'Base', 'Optimism', 'opBNB', 'Polygon', 'Binance', 'Avalanche',
  'Solana', 'zkSync Era', 'Linea', 'Scroll', 'Mantle', 'Blast', 'Gnosis', 'Fantom', 'Celo',
  'Tron', 'Starknet', 'Ink', 'Unichain', 'Soneium', 'Abstract', 'Berachain', 'Monad',
  'Hyperliquid L1', 'Mode', 'Taiko', 'Zora', 'World Chain', 'Lisk', 'Redstone', 'Superseed',
  'BOB', 'Corn', 'Sonic', 'MegaETH', 'Robinhood Chain', 'Arc', 'RSK', 'Stellar', 'Sei',
  'Injective', 'Sui', 'Aptos', 'Near', 'Kava', 'Fraxtal', 'Provenance', 'Hemi', 'Plasma',
]);

export function gasTier(chain: string): GasTier {
  if (chain === 'Ethereum') return 'high';
  if (LOW_GAS_CHAINS.has(chain)) return 'low';
  return 'medium';
}

/** One transaction's gas, in dollars, by tier: the low and high of the range the plan quotes. */
export function gasRange(tier: GasTier): [number, number] {
  if (tier === 'high') return [6, 12];
  if (tier === 'low') return [0.1, 1];
  return [1, 3];
}

function gasWords(tier: GasTier): string {
  if (tier === 'high') return 'about $6-$12 of gas per transaction';
  if (tier === 'low') return 'under $1 of gas per transaction';
  return 'about $1-$3 of gas per transaction';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curator') || c.includes('curator')) return `Deposit $${capital} into a ${name} curated vault on ${chain} and keep the vault shares.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow 30% of it in the same session so both sides of the position are active.`;
  if (c.includes('dex') || c.includes('liquidity manager')) return `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the LP position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC into ${chain} through ${name}, then use the bridged funds inside its app so the volume is counted.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, sized so a liquidation cannot take the deposit.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} and place one position in an active market, then leave the funds working until it resolves.`;
  if (c.includes('allocator')) return `Deposit $${capital} into a ${name} allocation vault on ${chain} and keep the shares through one full epoch.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the protocol's own vault.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in your own wallet.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full hold.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} into ${name}'s highest-TVL strategy vault on ${chain} and leave compounding on.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and keep the position through one funding cycle.`;
  if (c.includes('leveraged farm')) return `Open a $${capital} leveraged farm on ${name} at no more than 2x, with a stop set, and keep it open.`;
  if (c.includes('farm')) return `Stake $${capital} of LP tokens in ${name}'s farm on ${chain} and harvest only when the rewards page shows a claim.`;
  if (c.includes('chain')) return `Bridge $${capital} to the chain ${name} runs, use its flagship app once, and keep a balance staked or supplied.`;
  if (c.includes('payment')) return `Hold $${capital} in ${name} on ${chain} and route one real payment through it each week.`;
  if (c.includes('launchpad')) return `Hold $${capital} in the ${name} allocation asset on ${chain} and join one sale window when it opens.`;
  if (c.includes('privacy')) return `Shield $${capital} through ${name} on ${chain} and keep the shielded balance for the full hold.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index token on ${chain} and hold it.`;
  if (c.includes('locker')) return `Lock $${capital} of tokens through ${name} on ${chain} for the shortest lock that still counts.`;
  if (c.includes('ai') || c.includes('agent')) return `Spend $${capital} of usage on ${name}'s agent or compute service on ${chain} across the hold.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second action: a different kind of activity, so the wallet is not one-note. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const half = Math.max(10, Math.round(capital / 2));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Repay half the borrow, then re-borrow it a week later, so the wallet shows repeated lending activity rather than one deposit.`;
  if (c.includes('dex') || c.includes('liquidity manager')) return `Route one $${half} swap through ${p.name}'s router on ${chain} each week, so the wallet shows trading volume as well as liquidity.`;
  if (c.includes('bridge')) return `Bridge $${half} back through ${p.name} once, so the wallet shows volume in both directions.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim and restake the staking rewards once mid-hold, so the wallet shows an active staker rather than a dormant deposit.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Close the first hedge and open a second one half the size, so the wallet shows repeated trading rather than one position.`;
  return `Open a second, smaller position of $${half} in a different pool or vault of ${p.name} on ${chain}, so the wallet is active in more than one of its products.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names. Returns the steps and the
 * plan's totals, computed from the same figures.
 */
export function farmPlan(p: SnapshotProtocol, age: number | null): { steps: FarmStep[]; totals: PlanTotals } {
  const chain = chainOf(p);
  const tier = gasTier(chain);
  const [gasLow, gasHigh] = gasRange(tier);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(2, Math.round(hold / 7));
  const action = actionFor(p, capital, chain);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const secondTier = secondChain === null ? tier : gasTier(secondChain);
  const [gasLow2, gasHigh2] = gasRange(secondTier);
  const second = secondChain !== null
    ? `Repeat the position on ${secondChain} with half the capital ($${Math.max(10, Math.round(capital / 2))}), so the wallet is active on two of the protocol's chains.`
    : secondActionFor(p, capital, chain);
  // Transactions the plan asks for: fund, main action, second action, one a
  // week, one claim check, one exit. Gas is quoted per transaction by the
  // tier of the chain the transaction runs on.
  const txCount = 4 + weeks + 1;
  const steps: FarmStep[] = [
    {
      text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline and never in a screenshot.',
      cost: 'nothing to create, and never pay anyone to set it up',
      time: '10 minutes',
    },
    {
      text: `Fund the wallet with $${capital + 20} of USDC on ${chain} so the position and its gas are covered in one funding.`,
      cost: `$${capital + 20} of capital plus ${gasWords(tier)}`,
      time: '20 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gasWords(tier)}`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $${Math.max(10, Math.round(capital / 2))} more capital and ${gasWords(secondTier)}`,
      time: '15 minutes',
    },
    {
      text: `Make one qualifying action each week for ${weeks} weeks, such as a deposit, a borrow, a swap or a vote, so the activity spans several snapshots.`,
      cost: `${gasWords(tier)} a week, ${weeks} weeks in all`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days, and once mid-hold open the protocol's own points or rewards page to confirm the wallet is counted.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: 'Before you withdraw, claim only from the link the protocol itself publishes, never from a reply or a direct message; then log the wallet, the dates and every transaction, and unwind in reverse order.',
      cost: `${gasWords(tier)} to exit, and never pay to claim`,
      time: '15 minutes',
    },
  ];
  return {
    steps,
    totals: {
      capital_usd: capital,
      gas_low_usd: Math.round((gasLow * (txCount - 1) + gasLow2) * 100) / 100,
      gas_high_usd: Math.round((gasHigh * (txCount - 1) + gasHigh2) * 100) / 100,
      tx_count: txCount,
      weeks,
      hold_days: hold,
    },
  };
}

// ---------------------------------------------------------------- the board

/** One protocol scored, at full precision, before ranks are assigned. */
export interface ScoredRow {
  p: SnapshotProtocol;
  implied: number;
  multiple: number;
  multipleRaw: number;
  compN: number;
  catMedian: number | null;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
}

/** Every rankable protocol scored and sorted, strongest first, with its context. */
export function scoreAll(snapshot: Snapshot, model: ModelConstants = MODEL): { scored: ScoredRow[]; ctx: ScoreContext } {
  const comps = liveComps(snapshot);
  const rankable = snapshot.protocols.filter(isRankable);
  const ages = rankable.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null);
  const medianAge = Math.round(median(ages) ?? 365);
  const ctx: ScoreContext = { asOf: snapshot.as_of, comps, medianAge, model };
  const scored: ScoredRow[] = rankable.map((p) => {
    const s = impliedValue(p, ctx);
    return { p, ...s };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return { scored, ctx };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const watchlist = new Set(snapshot.watchlist);
  const { scored } = scoreAll(snapshot, model);
  return scored.map((s, i) => {
    const { steps } = farmPlan(s.p, s.age);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      list: listOf(s.p, snapshot, watchlist),
      age_days: s.age,
      implied_value_usd: s.implied,
      model: {
        multiple: round4(s.multiple),
        multiple_raw: round4(s.multipleRaw),
        comp_n: s.compN,
        category_median: s.catMedian === null ? null : round4(s.catMedian),
        growth_pct: round4(s.growthPct),
        growth_multiplier: round4(s.growthMult),
        maturity_multiplier: round4(s.maturityMult),
        breadth_multiplier: round4(s.breadthMult),
        age_days: s.age,
      },
      farm_steps: steps.map(stepText),
    };
  });
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** The excluded pre-token products, by TVL, with the reason each is set aside. */
export function setAsideRows(snapshot: Snapshot): SetAsideRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && exclusionReason(p) !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, SET_ASIDE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      reason: exclusionReason(p)!,
    }));
}

/** A scored row's dashboard form, with full-precision components and the farm plan kept structured. */
export function radarRow(s: ScoredRow, rank: number, list: ListKind): RadarRow {
  const { steps, totals } = farmPlan(s.p, s.age);
  return {
    rank,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    listed_at: s.p.listed_at,
    age_days: s.age,
    list,
    implied_value_usd: s.implied,
    multiple: s.multiple,
    multiple_raw: s.multipleRaw,
    comp_n: s.compN,
    category_median: s.catMedian,
    growth_pct: s.growthPct,
    growth_multiplier: s.growthMult,
    maturity_multiplier: s.maturityMult,
    breadth_multiplier: s.breadthMult,
    farm: steps,
    plan: totals,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const setAside = setAsideRows(snapshot);
  const comps = liveComps(snapshot);
  const { scored, ctx } = scoreAll(snapshot, model);
  const watchlist = new Set(snapshot.watchlist);
  const compRows: CompRow[] = [...comps.byCategory.entries()]
    .map(([category, entry]) => {
      const { multiple } = categoryMultiple(category, comps, model);
      return { category, n: entry.n, median: round4(entry.median), multiple: round4(multiple) };
    })
    .sort((a, b) => b.n - a.n || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => r.list === 'early').length,
    above_floor_size: board.filter((r) => r.list === 'above-floor').length,
    live_size: live.length,
    set_aside_size: setAside.length,
    median_age_days: ctx.medianAge,
    global_median_multiple: round4(comps.globalMedian),
    comps: compRows,
    rows: scored.map((s, i) => radarRow(s, i + 1, listOf(s.p, snapshot, watchlist))),
    live,
    set_aside: setAside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'the board repeats a slug';
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  const invented = board.filter((r) => !known.has(r.slug)).slice(0, 3).map((r) => r.slug);
  if (invented.length > 0) return `the board invents slugs: ${invented.join(', ')}`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (typeof r.name !== 'string' || r.name.length === 0) return `${r.slug} has no name`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isSafeInteger(r.rank) || r.rank <= 0) return `${r.slug} has rank ${r.rank}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
