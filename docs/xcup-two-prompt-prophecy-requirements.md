# XCup Two-Prompt Prophecy Flow — Technical Requirements

Status: proposed  
Scope: World Cup prophecy generation only  
Prepared from: current repository state and `codex_xcup_two_prompt_ai_flow_requirements (1).md`

Candidate schema, repair, and runtime fallback sections in this original
design are superseded by `docs/xcup-candidate-reliability-requirements.md`.

## 1. Objective

Replace the current one-call World Cup prophecy generation with a two-call AI
flow:

1. Candidate Generator researches the match and returns exactly five plausible
   scoreline paths.
2. Final Judge compares those candidates, ranks the best three, and returns the
   existing card-ready `WorldCupProphecyResult`.

The model remains responsible for the prediction. Application code controls
prompt sequencing, schema validation, consistency checks, retries, and output
transport. Application code must never select, replace, or heuristically alter
the final pick or scoreline.

## 2. Current Repository State

The current implementation already provides most of the requested output
plumbing:

- `src/app/api/xcup/prophecy/route.ts` makes one OpenAI Responses API call with
  required web search, parses JSON, normalizes the result, and returns
  `WorldCupProphecyResult`.
- `src/lib/xcup/types.ts` already contains:
  - pick confidence, prophecy probability, true market probability, and exact
    score confidence;
  - dominant scenario, scoring volume, top scorelines, confidence governor, and
    exact-score volatility;
  - goalkeeper and physical mismatch risk fields;
  - the detailed research fields requested in the source draft, except
    `candidateGenerationSummary`.
- `src/app/page.tsx` already renders Prediction Details with scenario, scoring
  volume, exact-score confidence, top scorelines, confidence governor, and
  exact-score volatility.
- `src/lib/xcup/renderProphecyCard.ts` already labels confidence as
  `PICK CONF`.
- `src/lib/xcup/buildProphecyMetadata.ts` already preserves pick confidence,
  exact-score confidence, dominant scenario, scoring volume, top scorelines,
  confidence governor, exact-score volatility, and the full prophecy payload.
- All paid Base, Arbitrum, Mantle, X Layer, Questflow, and Mantle DevKit routes
  delegate prophecy generation to
  `buildPaidWorldCupProphecyResponse()`, which calls the shared prophecy route.

Consequently, this feature does not require changes to payment providers,
payment verification, proxy routing, chain selection, NFT contracts, card
layout, or the normal mint flow.

## 3. Protected Boundaries and Non-Goals

The implementation must not modify the following without separate approval:

- `next.config.js`, `config/env/next.config.mjs`, Next.js runtime configuration,
  TLS/certificate handling, development host configuration, or deployment
  configuration unrelated to the two prompt variables;
- `src/proxy.ts`;
- Coinbase, OKX, Mantle-native, Questflow, or Mantle DevKit payment verification
  and settlement logic;
- LayerZero, chain IDs, RPC selection, wallet connection, leaderboard,
  dashboard, or bridge logic;
- smart contracts or ABIs;
- card template geometry, flags, fonts, or risk rendering;
- code that chooses a winner or scoreline.

Paid wrappers must continue to use the shared prophecy builder without
provider-specific prophecy implementations.

## 4. Required Runtime Flow

The public HTTP contract remains:

```txt
POST /api/xcup/prophecy
{ homeTeam, awayTeam, matchDate }
→ WorldCupProphecyResult
```

Internal processing becomes:

```txt
validate request
→ build Candidate Generator prompt
→ OpenAI call 1 with required web search
→ parse and normalize candidate JSON
→ validate candidate diversity
→ retry Candidate Generator once if invalid
→ build Final Judge prompt with original input and validated candidates
→ OpenAI call 2 without web search
→ parse and normalize final JSON
→ validate final schema and candidate consistency
→ retry Final Judge once if invalid
→ return the existing WorldCupProphecyResult shape
```

The Final Judge must receive the validated Candidate Generator result as
serialized JSON in a clearly delimited data block. It must not independently
research the match or receive a web-search tool.

## 5. Environment Configuration

Add these server-only variables:

```bash
XCUP_PROPHECY_CANDIDATES_PROMPT_SECRET="..."
XCUP_PROPHECY_FINAL_PROMPT_SECRET="..."
```

Keep the existing model setting:

```bash
XCUP_OPENAI_MODEL=gpt-5.5
```

The variables must never use the `NEXT_PUBLIC_` prefix.

The selected launch policy is an explicit legacy fallback. The legacy
single-prompt flow may run only when both of these variables are configured:

```bash
XCUP_PROPHECY_ALLOW_LEGACY_FALLBACK=1
XCUP_PROPHECY_PROMPT_SECRET="..."
```

Fallback behavior:

- Use the two-prompt flow when both new prompt secrets are present.
- If either new prompt secret is missing and the explicit fallback switch is
  `1`, use the existing `XCUP_PROPHECY_PROMPT_SECRET` single-prompt flow.
- If either new prompt secret is missing and fallback is not explicitly
  enabled, return a clear configuration error.
- If fallback is enabled but the legacy prompt is also missing, return a clear
  configuration error.
- Do not fall back after an OpenAI error, invalid candidate result, exhausted
  retry, or invalid Final Judge result. Those failures return `502`; silently
  replacing a failed two-prompt attempt with the old flow would hide prediction
  integrity problems.
- No automatic production-only fallback may be inferred from `NODE_ENV`.

The successful API response remains identical in both modes. Legacy results may
lack candidate-derived proof fields when the old prompt does not produce them.
Server logs must identify the selected mode as `two-prompt` or
`legacy-fallback` without logging prompt contents.

## 6. Type Changes

Add to `src/lib/xcup/types.ts`:

```ts
export type WorldCupScoringVolume = 'Low' | 'Medium' | 'High';

export type WorldCupDominantScenario =
  | 'Favorite control'
  | 'Favorite pressure with concession'
  | 'Favorite attacking breakout'
  | 'Draw trap'
  | 'Chaotic transition game'
  | 'Underdog disruption'
  | 'Low-event stalemate'
  | 'Set-piece swing game';

export type WorldCupScorelineCandidate = {
  rank?: number;
  pick: string;
  scoreline: string;
  dominantScenario: WorldCupDominantScenario | string;
  scoringVolume: WorldCupScoringVolume | string;
  exactScoreConfidence?: number;
  shortReason: string;
  strengths?: string;
  weaknesses?: string;
};

export type WorldCupCandidateGenerationResult = {
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  location?: string;
  researchSummary: string;
  mainSignals: {
    favoriteSignals?: string[];
    underdogSignals?: string[];
    drawTrapSignals?: string[];
    breakoutSignals?: string[];
    lowEventSignals?: string[];
  };
  candidates: WorldCupScorelineCandidate[];
  sources?: string[];
};
```

Also add:

```ts
candidateGenerationSummary?: string;
```

to `WorldCupResearchContext`.

Use `WorldCupScoringVolume | string` for the existing
`WorldCupResearchContext.scoringVolume` field. Existing result and risk fields
must remain backward-compatible.

## 7. Candidate Generator Contract

### 7.1 Inputs

The prompt receives only:

- original home team;
- original away team;
- original match date;
- the private Candidate Generator prompt and application-owned schema rules.

User-provided team names and dates must be inserted as data, not executable
prompt instructions.

### 7.2 OpenAI call

```ts
client.responses.create({
  model,
  tools: [{ type: 'web_search', search_context_size: 'medium' }],
  tool_choice: 'required',
  input: candidatePrompt,
});
```

### 7.3 Required output

The Candidate Generator returns JSON only and includes:

- input teams and match date;
- optional location;
- research summary;
- structured main signals;
- exactly five candidates;
- source URLs.

Every candidate includes:

- `pick`;
- `scoreline`;
- `dominantScenario`;
- `scoringVolume`;
- `exactScoreConfidence`;
- `shortReason`;
- `strengths`;
- `weaknesses`.

It must not return final card copy or declare one candidate to be the final
prophecy.

### 7.4 Candidate normalization

Normalization may:

- trim whitespace;
- clamp numeric confidence to `0..100`;
- discard malformed source URLs;
- cap text lengths to safe API/UI limits;
- normalize recognized scoring-volume capitalization.

Normalization must not:

- change a candidate's pick;
- change score digits or winner;
- add a missing candidate;
- duplicate a candidate to reach five;
- replace a repetitive scoreline;
- rank or select candidates.

## 8. Candidate Validation

A candidate result is valid only when:

- there are exactly five structurally complete candidates;
- every candidate has a non-empty pick, scoreline, scenario, scoring volume,
  exact-score confidence, and short reason;
- every scoreline is parseable as two non-negative integer scores;
- every candidate pick is exactly the home team, away team, or `Draw`;
- the pick agrees with the scoreline winner;
- there are at least three distinct normalized scorelines;
- there are at least two distinct non-empty scenarios;
- `2-1`/`1-2`, interpreted by home-away orientation, appears no more than twice;
- all five candidates are not the same non-draw pick with a one-goal winning
  margin;
- duplicate candidates are not used to satisfy the count.

Scoring-volume diversity remains a prompt-level requirement, not a hard
validator, because “when match evidence supports it” cannot be determined by
code without allowing code to judge football evidence.

The validator may compute canonical comparison keys, but it must preserve the
model's original candidate strings in the payload sent to the Final Judge.

### 8.1 Candidate retry

Allow at most one repair/regeneration call. The retry receives:

- the original match input;
- concise validation failures;
- the instruction to regenerate the complete five-candidate JSON.

Do not patch the invalid set in code. If the retry remains invalid, return a
`502` error and do not call the Final Judge.

## 9. Final Judge Contract

### 9.1 Inputs

The Final Judge receives:

- original match input;
- Candidate Generator research summary and main signals;
- all five validated candidates;
- Candidate Generator sources;
- the private Final Judge prompt and existing card-readability rules.

### 9.2 OpenAI call

```ts
client.responses.create({
  model,
  input: finalPrompt,
});
```

No web-search tool is supplied. The judge must compare the supplied candidate
set rather than restart research.

### 9.3 Required output

The output remains the existing `WorldCupProphecyResult` JSON contract and must
include:

- valid final pick and scoreline;
- pick confidence and matching `prophecyProbability`;
- lower or equal `exactScoreConfidence`;
- concise card prophecy and exactly two reasoning lines;
- all required criteria;
- relevant risks and reasons;
- `research.dominantScenario`;
- `research.scoringVolume`;
- exactly three ranked `research.topScorelines`;
- `research.confidenceGovernor`;
- `research.exactScoreVolatility`;
- `research.candidateGenerationSummary`;
- sources inherited from Candidate Generator research.

`research.topScorelines[*]` should use the existing public shape:

```ts
{ rank: number; scoreline: string; shortReason: string }
```

The full five-candidate internal result does not need to be returned to the
browser or stored in NFT metadata.

## 10. Final Validation

The final result is valid only when:

- required existing fields are present;
- `pick` is exactly the input home team, input away team, or `Draw`;
- `scoreline` is non-empty and parseable;
- pick and scoreline winner agree;
- confidence and `prophecyProbability` are both present and equal;
- `exactScoreConfidence` is present and is not greater than pick confidence;
- reasoning has exactly two non-empty lines within current card limits;
- `research.topScorelines` has exactly three unique ranks `1`, `2`, and `3`;
- every top-three scoreline came from the validated candidate set;
- final scoreline exactly matches rank 1 after whitespace trimming;
- final pick matches the rank-1 candidate pick;
- rank-1 scenario and scoring volume are preserved in
  `research.dominantScenario` and `research.scoringVolume`;
- required proof-layer fields are non-empty.

The route must not repair inconsistencies by assigning rank 1 to the final
scoreline or assigning the final scoreline from rank 1.

### 10.1 Final retry

Allow at most one Final Judge repair call. The retry receives:

- the prior final JSON;
- the original match input;
- the immutable candidate set;
- concise validation failures;
- an instruction to return the complete corrected final JSON.

If the retry remains invalid, return `502`. Never fall back to a code-selected
candidate.

## 11. Source Preservation

Web sources are collected only from the Candidate Generator response:

- valid URLs in candidate JSON;
- Responses API web-search annotations/sources.

The route unions and deduplicates these URLs, caps them at the existing limit,
and writes them to `result.research.sources`. The Final Judge cannot erase or
invent the authoritative source list.

This source merge is transport integrity, not prediction selection, and is
therefore allowed in application code.

## 12. Public UI and Card Requirements

No card layout change is required. The current renderer already:

- displays `PICK CONF`;
- excludes exact-score confidence, market probability, top scorelines,
  confidence governor, and exact-score volatility from the summary;
- renders the current prophecy, reasoning, criteria, and relevant risks.

The current Prediction Details UI already covers the required proof layer.
Implementation must verify that the new final response populates:

- scenario;
- scoring volume;
- exact-score confidence;
- top three scorelines;
- why this prophecy (`confidenceGovernor`);
- exact-score volatility.

UI changes should be limited to wording or empty-state handling only if
verification exposes a concrete issue.

## 13. Metadata and Mint Compatibility

`buildWorldCupProphecyMetadata()` remains the sole metadata builder for normal
and paid flows.

The existing metadata already stores the required prediction proof fields. Add
`candidateGenerationSummary` only if it is useful for provenance; do not store
the full five-candidate object by default because it increases metadata size
without changing the public proof layer.

No changes are required in:

- `mintWithImage()` calls;
- Pinata image upload order;
- paid response shape;
- x402 usage recording;
- chain-specific routes.

## 14. Error and Compatibility Requirements

- `400`: missing or invalid request fields.
- `500`: missing API key or required prompt configuration.
- `502`: OpenAI failure, invalid JSON, exhausted candidate validation, or
  exhausted final validation.
- Responses must remain `Cache-Control: no-store` through existing callers.
- The successful API response must remain assignable to
  `WorldCupProphecyResult`.
- Paid route response nesting remains unchanged:
  `body.prophecy` contains the final result.
- Never log prompt secrets, API keys, or full private prompt text.

## 15. Observability

Add structured server logs with a generated request ID for:

- candidate call start/end and duration;
- candidate validation failures and retry count;
- final call start/end and duration;
- final validation failures and retry count;
- selected model;
- terminal error category.

Logs may include team names, match date, validation codes, and candidate
scoreline keys. They must not include private prompts or credentials.

Suggested validation codes:

```txt
CANDIDATE_COUNT
CANDIDATE_SCHEMA
CANDIDATE_SCORELINE
CANDIDATE_PICK_MISMATCH
CANDIDATE_DIVERSITY
CANDIDATE_REPETITIVE_NARROW_WIN
FINAL_SCHEMA
FINAL_PICK
FINAL_SCORELINE
FINAL_CONFIDENCE
FINAL_TOP_THREE
FINAL_NOT_FROM_CANDIDATES
FINAL_RANK_ONE_MISMATCH
```

## 16. Test Requirements

### 16.1 Unit tests

Extract pure helpers from the route where practical and test:

- JSON extraction;
- prompt placeholder replacement;
- scoreline parsing and canonical comparison;
- candidate normalization without pick/score mutation;
- all candidate validation rules;
- final validation rules;
- source merging;
- missing prompt configuration;
- one-retry limits.

### 16.2 Integration tests with mocked OpenAI

Cover:

1. valid candidate result and valid final result;
2. invalid candidates followed by a valid retry;
3. two invalid candidate attempts, with no Final Judge call;
4. valid candidates and invalid final followed by valid repair;
5. two invalid final attempts returning `502`;
6. Final Judge selecting a scoreline outside the candidate set;
7. final scoreline not matching top rank;
8. source preservation from call 1;
9. paid builder receiving the unchanged final prophecy response;
10. legacy fallback activates only when explicitly enabled and a new prompt is
    missing;
11. legacy fallback does not activate after a failed two-prompt attempt;
12. enabled fallback with a missing legacy prompt returns a configuration
    error.

### 16.3 Manual quality matrix

Run at least:

```txt
Japan vs Tunisia
Ecuador vs Curaçao
Belgium vs Iran
Uruguay vs Cabo Verde
Brazil vs Haiti
Netherlands vs Sweden
Canada vs Qatar
Mexico vs South Korea
```

For each match record:

- five generated candidates;
- scoreline/scenario diversity;
- selected top three;
- final scoreline;
- whether `2-1` was selected;
- candidate and final retries;
- total latency;
- successful card render;
- successful normal metadata build;
- one paid-path smoke test without changing payment code.

The quality review should confirm that repeated favorite matches do not all
collapse into the same “favorite 2-1” story. This is a model-output evaluation,
not a reason to add code-based score overrides.

## 17. Acceptance Criteria

- The shared prophecy API makes two OpenAI calls on the valid first-attempt
  path.
- Candidate call uses required web search; Final Judge call has no web search.
- Exactly five candidates pass structural and diversity validation.
- At most one retry is made per stage.
- Final top three all come from the validated candidate set.
- Final scoreline and pick match rank 1.
- Code never chooses or changes the prediction.
- The existing browser, renderer, metadata, mint, and paid-wrapper contracts
  remain compatible.
- Card still displays `PICK CONF`.
- Prediction Details displays the complete comparison proof layer.
- No changes are made to Next/TLS configuration, proxy/payment logic, chain
  logic, bridge logic, or contracts.
- Build, unit tests, mocked integration tests, normal prophecy smoke test,
  render smoke test, and one paid-wrapper smoke test pass.

## 18. Recommended File Change Set

Expected:

```txt
src/app/api/xcup/prophecy/route.ts
src/lib/xcup/types.ts
README.md
tests or test files for the prophecy route/helpers
```

Optional only if extraction improves testability:

```txt
src/lib/xcup/prophecyFlow.ts
src/lib/xcup/prophecyValidation.ts
```

Not expected:

```txt
src/proxy.ts
next.config.js
config/env/next.config.mjs
src/lib/x402/*
src/lib/server/*402*
src/app/api/x402/**/*
src/lib/xcup/renderProphecyCard.ts
src/lib/xcup/buildPaidWorldCupProphecyResponse.ts
smart contracts, ABIs, bridge, leaderboard, or dashboard files
```

Any need to edit an item in the “Not expected” list must be explained and
approved before implementation.

## 19. Confirmed Deployment Decision

Cookieverse will support the legacy single-prompt flow as an explicit
configuration fallback:

```bash
XCUP_PROPHECY_ALLOW_LEGACY_FALLBACK=1
```

It is used only when one or both new two-prompt secrets are unavailable and the
legacy `XCUP_PROPHECY_PROMPT_SECRET` is configured. It is not an error-recovery
path after a two-prompt generation attempt has started.
