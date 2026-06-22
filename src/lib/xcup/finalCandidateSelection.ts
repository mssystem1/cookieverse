import type {
  WorldCupScorelineCandidate,
} from './types';
import type { ProphecyValidationIssue } from './prophecyValidation';

export type WorldCupCandidatePool = {
  candidatePool: Record<string, WorldCupScorelineCandidate>;
};

type RankedCandidateSelection = {
  rank: number;
  candidateId: string;
  shortReason: string;
};

export function materializeFinalCandidateSelection(
  raw: any,
  pool: WorldCupCandidatePool,
): {
  value: any | null;
  issues: ProphecyValidationIssue[];
} {
  const issues: ProphecyValidationIssue[] = [];
  const selectedCandidateId =
    typeof raw?.selectedCandidateId === 'string'
      ? raw.selectedCandidateId.trim()
      : '';
  const selectedCandidate = pool.candidatePool[selectedCandidateId];
  const topCandidates = Array.isArray(raw?.topCandidates)
    ? (raw.topCandidates as RankedCandidateSelection[])
    : [];

  if (!selectedCandidateId || !selectedCandidate) {
    issues.push({
      code: 'FINAL_SELECTED_CANDIDATE',
      message: 'selectedCandidateId must identify a supplied candidate.',
      severity: 'hard',
    });
  }

  const ranks = new Set(topCandidates.map((item) => item?.rank));
  const ids = new Set(topCandidates.map((item) => item?.candidateId));

  if (
    topCandidates.length !== 3 ||
    ranks.size !== 3 ||
    ids.size !== 3 ||
    !ranks.has(1) ||
    !ranks.has(2) ||
    !ranks.has(3) ||
    topCandidates.some(
      (item) =>
        !item ||
        typeof item.candidateId !== 'string' ||
        !pool.candidatePool[item.candidateId],
    )
  ) {
    issues.push({
      code: 'FINAL_RANKED_CANDIDATES',
      message:
        'topCandidates must rank three distinct supplied candidate IDs as 1, 2, and 3.',
      severity: 'hard',
    });
  }

  const rankOne = topCandidates.find((item) => item?.rank === 1);
  if (
    selectedCandidateId &&
    rankOne?.candidateId &&
    selectedCandidateId !== rankOne.candidateId
  ) {
    issues.push({
      code: 'FINAL_SELECTED_RANK_ONE',
      message: 'selectedCandidateId must equal topCandidates rank 1.',
      severity: 'hard',
    });
  }

  if (issues.length > 0 || !selectedCandidate) {
    return { value: null, issues };
  }

  const topScorelines = [...topCandidates]
    .sort((a, b) => a.rank - b.rank)
    .map((item) => {
      const candidate = pool.candidatePool[item.candidateId];
      return {
        rank: item.rank,
        scoreline: candidate.scoreline,
        shortReason:
          typeof item.shortReason === 'string' && item.shortReason.trim()
            ? item.shortReason
            : candidate.shortReason,
      };
    });

  return {
    value: {
      ...raw,
      pick: selectedCandidate.pick,
      scoreline: selectedCandidate.scoreline,
      exactScoreConfidence: selectedCandidate.exactScoreConfidence,
      research: {
        ...(raw.research || {}),
        dominantScenario: selectedCandidate.dominantScenario,
        scoringVolume: selectedCandidate.scoringVolume,
        topScorelines,
      },
    },
    issues: [],
  };
}
