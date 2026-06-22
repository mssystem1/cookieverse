# XCup Candidate Generation Reliability — Technical Requirements

## 1. Objective

Prevent a paid or free prophecy request from failing solely because the two-prompt Candidate Generator returned inconsistent `pick` and `scoreline` strings or insufficiently diverse candidates.

The solution must preserve the existing prophecy outcome architecture:

1. The Candidate Generator proposes five possible outcomes.
2. The Final Judge selects and ranks outcomes from that candidate set.
3. The legacy `XCUP_PROPHECY_PROMPT_SECRET` flow is used as an explicit runtime safety fallback.

No changes are authorized to payment verification, x402 settlement, chain logic, TLS handling, Next.js configuration, holdings endpoints, or unrelated application behavior.

## 2. Current Failure Analysis

### 2.1 Pick and scoreline duplicate the same decision

The Candidate Generator currently returns both:

- a textual `pick`;
- a textual `scoreline`.

Validation parses the scoreline as home goals followed by away goals, then rejects the candidate if the independently generated `pick` disagrees with that interpretation.

This creates avoidable failures such as `CANDIDATE_PICK_MISMATCH`. The model has already selected the result through the goals, so asking it to repeat the same decision in another field introduces a consistency risk without adding useful information.

### 2.2 Text scorelines are ambiguous

The current parser accepts a plain numeric pair such as `2-1`. The prompt does not sufficiently guarantee that:

- the home team is always represented by the first number;
- the output contains no labels or explanatory text;
- the model does not write the winning team first.

This likely causes both mismatches and `CANDIDATE_SCORELINE` failures.

### 2.3 Retry repeats research instead of repairing output

After a failed candidate attempt, the current retry runs the full Candidate Generator again with web search and passes validation issue codes, but not the rejected candidate payload.

Consequences:

- the second attempt cannot repair the exact invalid fields;
- research latency and cost are repeated;
- a mostly useful first result is discarded;
- the second response can fail differently from the first.

Observed failed candidate stages take roughly two minutes or longer before returning `502`.

### 2.4 Diversity is treated as a transport-level failure

Candidate diversity is a quality objective, not malformed transport data. A lack of diversity should initiate repair or fallback, but it should not directly terminate a request with `502`.

### 2.5 Legacy fallback is configuration-only

The legacy flow currently applies when the two new prompt variables are unavailable and fallback is enabled. It does not protect requests from runtime Candidate Generator or Final Judge failures.

## 3. Required Candidate Data Model

### 3.1 Raw AI candidate

The Candidate Generator output must use a raw type equivalent to:

```ts
type WorldCupRawScorelineCandidate = {
  candidateType: WorldCupCandidateType;
  homeGoals: number;
  awayGoals: number;
  dominantScenario: string;
  scoringVolume: string;
  exactScoreConfidence?: number;
  viabilityScore: number;
  evidenceFit: string;
  contradiction: string;
  shortReason: string;
  strengths?: string[];
  weaknesses?: string[];
};
```

The raw AI schema must not request `pick` or `scoreline`.

### 3.2 Numeric goal constraints

`homeGoals` and `awayGoals` must:

- be finite integers;
- be greater than or equal to zero;
- be no greater than a documented defensive maximum, recommended as `10`;
- refer strictly to the supplied home and away teams respectively.

Invalid values must not be silently clamped or rounded. They must enter the repair/fallback path.

### 3.3 Deterministic normalization

Application code must derive:

```ts
scoreline = `${homeGoals}-${awayGoals}`;
```

The normalized `pick` must be:

- `homeTeam` when `homeGoals > awayGoals`;
- `awayTeam` when `awayGoals > homeGoals`;
- `Draw` when the values are equal.

This derivation is not an application-selected prediction. The model selects the goals; code only produces consistent representations of that choice.

### 3.4 Backward compatibility

The Final Judge and final API response may continue receiving `pick` and `scoreline`. Existing client-facing `WorldCupProphecyResult` fields and meanings must remain compatible.

## 4. Required Candidate Slots

The Candidate Generator must return exactly one candidate for each fixed slot:

1. `baseline`
2. `low_event`
3. `high_event`
4. `draw_path`
5. `alternative_or_disruption`

These generic slots are recommended because they work for matches without a clear favorite.

The schema must reject:

- missing slots;
- duplicate slots;
- unknown slots;
- more or fewer than five candidates.

Prefer an object keyed by slot name if supported cleanly by the response schema. Otherwise, use an array with strict uniqueness validation.

Fixed slots guide scenario exploration but do not replace score-diversity checks.

Candidates form an unranked pool. Their source array order must not imply
likelihood. Before the Final Judge call, randomize the candidates and serialize
them as a keyed `candidatePool` object. Object keys are opaque and carry no
ranking meaning.

Candidate prompts must contain no concrete goal-pair examples or populated
goal/confidence JSON defaults. The Final Judge must compare `viabilityScore`,
`evidenceFit`, and `contradiction`, rather than prefer the baseline slot or the
first serialized candidate.

The Final Judge must return an opaque `selectedCandidateId` and three ranked
candidate IDs. It must not repeat immutable candidate fields. Application code
copies scoreline, pick, scenario, scoring volume, exact-score confidence, and
ranked scorelines from the selected candidates. Textual scenario or volume
equality must not trigger a repair call.

## 5. Validation Classification

### 5.1 Hard structural failures

The following are hard failures of the candidate payload:

- response is not valid structured data;
- candidate collection does not contain all five required slots exactly once;
- required fields are missing or have invalid types;
- goals are non-integer, negative, or above the defensive maximum;
- required explanatory text is empty.

A hard failure must trigger the single repair attempt. It must not immediately return a final `502`.

### 5.2 Soft quality issues

The following are warnings requiring repair or fallback:

- fewer than three distinct scorelines;
- insufficient scoring-volume or scenario diversity;
- excessive repetition of the same common scoreline;
- all candidates selecting the same narrow-win pattern;
- semantically weak differentiation between slots.

`CANDIDATE_DIVERSITY` must not directly cause a final `502`.

If fewer than three distinct valid scorelines remain after repair, the two-prompt flow must not continue to the Final Judge because the current final requirement for three distinct ranked outcomes cannot be satisfied. It must invoke legacy fallback.

### 5.3 Removed validation

`CANDIDATE_PICK_MISMATCH` must be removed from raw candidate validation because raw candidates no longer provide a `pick`.

String scoreline parsing must not be part of new Candidate Generator validation.

## 6. Generation and Repair Sequence

### 6.1 Initial generation

The first Candidate Generator call must:

- use `XCUP_PROPHECY_CANDIDATES_PROMPT_SECRET`;
- perform the currently required match research;
- request the numeric, slot-based schema;
- return exactly five raw candidates.

### 6.2 Single focused repair

If initial validation reports hard failures or soft quality issues, make no more than one repair call.

The repair call must receive:

- the original candidate payload when it can be parsed;
- explicit validation codes;
- slot-specific descriptions of invalid or weak fields;
- the same match identity and home/away orientation.

The repair call must:

- repair the submitted payload rather than regenerate research from scratch;
- avoid web search;
- return a complete replacement set of all five candidates;
- use the same numeric schema.

If the initial response is wholly unparseable, the repair call may regenerate candidates from the original match context, but must still avoid repeating web research unless the API provides no reusable research context.

### 6.3 Bounded execution

The sequence must be bounded:

1. one researched candidate call;
2. one no-web repair call when needed;
3. one legacy fallback attempt when the two-prompt path cannot continue.

There must be no retry or fallback loop.

## 7. Runtime Legacy Fallback

### 7.1 Trigger

When enabled by the existing legacy fallback setting, invoke the old `XCUP_PROPHECY_PROMPT_SECRET` flow if:

- Candidate Generator output still has hard failures after repair;
- repaired candidates cannot satisfy the minimum diversity needed by the Final Judge;
- Candidate Generator request execution fails after its allowed attempts.

The same fallback must also apply when the Final Judge request or final validation fails.

### 7.2 Response behavior

If legacy fallback succeeds:

- return the normal successful prophecy response;
- do not expose internal validation errors to the user;
- record that runtime fallback was used in server telemetry.

A final `502` caused by prophecy generation is permitted only when:

1. the two-prompt path cannot produce a valid result; and
2. the legacy fallback was attempted and also failed, or fallback is explicitly disabled.

### 7.3 Scope

Fallback logic should reside in the shared prophecy generation layer so free and paid route wrappers receive consistent behavior without changing payment or settlement code.

## 8. Environment Prompt Requirements

### 8.1 Candidate prompt

`XCUP_PROPHECY_CANDIDATES_PROMPT_SECRET` must be updated to:

- request `candidateType`, `homeGoals`, and `awayGoals`;
- remove model-generated `pick` and `scoreline`;
- state that `homeGoals` always belongs to `HOME_TEAM`;
- state that `awayGoals` always belongs to `AWAY_TEAM`;
- require each fixed candidate slot exactly once;
- define the intent of each slot;
- require integer JSON values, not numeric strings;
- prohibit labels or score text in goal fields;
- require JSON-only output compatible with the application schema.

### 8.2 Final Judge prompt

`XCUP_PROPHECY_FINAL_PROMPT_SECRET` must be updated to:

- consume application-normalized candidates containing derived `pick` and `scoreline`;
- preserve the supplied home/away orientation;
- select outcomes only from supplied candidates;
- never reverse, reinterpret, or invent candidate scores;
- continue returning the existing final result schema.

### 8.3 Legacy prompt

`XCUP_PROPHECY_PROMPT_SECRET` must remain unchanged unless a separately reviewed requirement identifies a legacy-flow defect.

### 8.4 Deployment configuration

Both new prompt values must be updated in:

- local environment configuration used for testing;
- the deployment provider environment for every applicable environment.

Prompt contents must not be committed when they are secrets.

## 9. Structured Output

Use an API-enforced structured JSON schema for Candidate Generator output when supported by the selected model and its tool configuration.

Application-side validation remains mandatory even when structured output is enabled. If structured output cannot be combined with the required research tool, retain manual validation and the repair/fallback sequence.

## 10. Observability

Server logs for each candidate attempt must include:

- request ID;
- generation phase: `initial`, `repair`, or `legacy-runtime-fallback`;
- duration;
- hard failure codes;
- soft warning codes;
- candidate slot;
- numeric goals;
- derived scoreline and pick.

Logs must not include secret prompts, full research content, credentials, or unrelated user data.

Fallback logs must include the reason for abandoning the two-prompt flow and the accumulated duration before fallback.

## 11. Testing Requirements

Automated tests must cover:

- home win, away win, and draw derivation;
- scoreline formatting from numeric goals;
- rejection of strings, decimals, negatives, non-finite numbers, and excessive goals;
- missing, duplicate, and unknown candidate slots;
- deterministic removal of pick/scoreline mismatch failures;
- soft diversity issue initiating repair rather than `502`;
- successful repair continuing to the Final Judge;
- repair with fewer than three scorelines invoking legacy fallback;
- hard failure after repair invoking legacy fallback;
- successful legacy fallback returning `200`;
- legacy fallback failure allowing the final error response;
- no second web-research call during focused repair;
- Final Judge receiving only normalized candidates;
- unchanged final response compatibility for web and app consumers;
- identical reliability behavior through free and paid wrappers.

## 12. Acceptance Criteria

The change is accepted when:

1. Candidate Generator no longer emits or validates model-provided `pick` and `scoreline`.
2. Every normalized candidate has a code-derived, internally consistent scoreline and pick.
3. Candidate generation performs at most one researched call and one focused repair.
4. `CANDIDATE_DIVERSITY` cannot directly cause the request's final `502`.
5. An exhausted candidate path attempts the configured legacy flow.
6. No prophecy-generation `502` is returned when legacy fallback produces a valid result.
7. Existing payment, settlement, network, metadata, and unrelated core behavior is unchanged.
8. The focused validation and route tests pass.

## 13. Confirmed Product Decisions

1. Runtime legacy fallback applies to both Candidate Generator and Final Judge execution or validation failures.
2. The approved fixed slots are `baseline`, `low_event`, `high_event`, `draw_path`, and `alternative_or_disruption`.
3. Runtime fallback applies uniformly to free and every paid provider route through the shared prophecy generation layer.
