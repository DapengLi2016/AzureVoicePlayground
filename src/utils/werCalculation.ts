/**
 * Word Error Rate (WER) Calculation Utility
 *
 * WER = (Substitutions + Deletions + Insertions) / Total Words in Reference
 * Uses Levenshtein distance at word level
 */

export interface WERResult {
  wer: number;                    // Word Error Rate (0-1)
  werPercentage: number;          // WER as percentage (0-100)
  substitutions: number;
  deletions: number;
  insertions: number;
  totalReferenceWords: number;
  totalHypothesisWords: number;
  referenceText: string;
  hypothesisText: string;
  accuracy: number;               // 1 - WER (clamped to 0-1)
  accuracyPercentage: number;     // Accuracy as percentage
}

/**
 * Normalize text for WER comparison
 * - Converts to lowercase
 * - Removes punctuation
 * - Normalizes whitespace
 * - Removes HD voice markers like [laughter], [whisper], etc.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Remove HD voice emotion/style markers like [laughter], [whisper], [shouting], [angry], [sad]
    .replace(/\[(?:laughter|whisper|shouting|angry|sad|singing|sigh|cough)\]/gi, '')
    // Remove punctuation but keep apostrophes in contractions
    .replace(/[^\w\s']/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized.split(' ').filter(word => word.length > 0);
}

/**
 * Calculate Levenshtein distance at word level with backtracking
 * Returns the edit operations needed to transform reference to hypothesis
 */
function calculateEditDistance(reference: string[], hypothesis: string[]): {
  distance: number;
  substitutions: number;
  deletions: number;
  insertions: number;
} {
  const m = reference.length;
  const n = hypothesis.length;

  // Create DP matrix
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;  // Deletions
  for (let j = 0; j <= n; j++) dp[0][j] = j;  // Insertions

  // Fill DP matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (reference[i - 1] === hypothesis[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];  // Match
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,  // Substitution
          dp[i - 1][j] + 1,      // Deletion
          dp[i][j - 1] + 1       // Insertion
        );
      }
    }
  }

  // Backtrack to count operations
  let i = m;
  let j = n;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && reference[i - 1] === hypothesis[j - 1]) {
      // Match - no operation
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      // Substitution
      substitutions++;
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      // Deletion (word in reference not in hypothesis)
      deletions++;
      i--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      // Insertion (word in hypothesis not in reference)
      insertions++;
      j--;
    } else {
      // Edge case - shouldn't happen with correct implementation
      break;
    }
  }

  return {
    distance: dp[m][n],
    substitutions,
    deletions,
    insertions
  };
}

/**
 * Calculate Word Error Rate (WER) between reference and hypothesis text
 *
 * @param referenceText - The original/expected text
 * @param hypothesisText - The recognized/transcribed text
 * @returns WERResult with detailed metrics
 */
export function calculateWER(referenceText: string, hypothesisText: string): WERResult {
  const referenceWords = tokenize(referenceText);
  const hypothesisWords = tokenize(hypothesisText);

  // Edge case: empty reference
  if (referenceWords.length === 0) {
    const insertions = hypothesisWords.length;
    return {
      wer: insertions > 0 ? 1 : 0,
      werPercentage: insertions > 0 ? 100 : 0,
      substitutions: 0,
      deletions: 0,
      insertions,
      totalReferenceWords: 0,
      totalHypothesisWords: hypothesisWords.length,
      referenceText,
      hypothesisText,
      accuracy: insertions > 0 ? 0 : 1,
      accuracyPercentage: insertions > 0 ? 0 : 100
    };
  }

  const { substitutions, deletions, insertions } = calculateEditDistance(referenceWords, hypothesisWords);

  const totalErrors = substitutions + deletions + insertions;
  const wer = totalErrors / referenceWords.length;

  // Clamp accuracy to 0-1 range (WER can exceed 1 if many insertions)
  const accuracy = Math.max(0, 1 - wer);

  return {
    wer,
    werPercentage: Math.round(wer * 10000) / 100,  // Round to 2 decimal places
    substitutions,
    deletions,
    insertions,
    totalReferenceWords: referenceWords.length,
    totalHypothesisWords: hypothesisWords.length,
    referenceText,
    hypothesisText,
    accuracy,
    accuracyPercentage: Math.round(accuracy * 10000) / 100
  };
}
