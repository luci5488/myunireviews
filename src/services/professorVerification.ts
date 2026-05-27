/**
 * professorVerification.ts
 *
 * Attempts to auto-verify a professor suggestion against public academic databases.
 * Currently uses:
 *   1. OpenAlex  – https://api.openalex.org  (free, no API key)
 *   2. ORCID     – https://pub.orcid.org     (free public search, fallback)
 *
 * Confidence thresholds
 *   ≥ 0.80  → auto-approve (high confidence the person exists at that institution)
 *   < 0.80  → leave in pending queue for a moderator
 */

import { pool } from '../config/db';
import logger from '../lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerificationResult {
  verified: boolean;
  score: number;          // 0.0 – 1.0
  source: string | null;
  data: Record<string, unknown> | null;
}

interface SuggestionRecord {
  id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  institution_id: number;
  department_id: number | null;
  suggested_by: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUTO_APPROVE_THRESHOLD = 0.80;

/** Normalise a string for fuzzy comparison: lowercase, collapse whitespace */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Simple token-overlap similarity between two strings (0–1) */
function nameSimilarity(a: string, b: string): number {
  const tokA = new Set(norm(a).split(' '));
  const tokB = new Set(norm(b).split(' '));
  const intersection = [...tokA].filter(t => tokB.has(t)).length;
  return intersection / Math.max(tokA.size, tokB.size);
}

/**
 * Look up the institution's display name from the DB.
 * OpenAlex uses full names like "University of Sydney", not abbreviations.
 */
async function getInstitutionName(institutionId: number): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT name FROM institutions WHERE id = $1`,
    [institutionId],
  );
  return rows[0]?.name ?? null;
}

// ─── OpenAlex ─────────────────────────────────────────────────────────────────

/**
 * Search OpenAlex for an author matching (first_name + last_name) at institutionName.
 * Docs: https://docs.openalex.org/api-entities/authors
 */
async function checkOpenAlex(
  firstName: string,
  lastName: string,
  institutionName: string,
): Promise<VerificationResult> {
  const fullName = `${firstName} ${lastName}`;
  const params = new URLSearchParams({
    search: fullName,
    'filter': `affiliations.institution.display_name.search:${institutionName}`,
    per_page: '5',
    select: 'id,display_name,last_known_institutions,affiliations',
    mailto: 'admin@myunireviews.com', // polite pool – OpenAlex prefers this
  });

  const url = `https://api.openalex.org/authors?${params}`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
    headers: { 'User-Agent': 'MyUniReviews/1.0 (admin@myunireviews.com)' },
  });

  if (!resp.ok) {
    logger.warn({ status: resp.status, url }, 'OpenAlex API error');
    return { verified: false, score: 0, source: 'openalex', data: null };
  }

  const json = await resp.json() as {
    results: Array<{
      id: string;
      display_name: string;
      last_known_institutions: Array<{ display_name: string }>;
      affiliations: Array<{ institution: { display_name: string } }>;
    }>;
    meta: { count: number };
  };

  if (!json.results?.length) {
    return { verified: false, score: 0, source: 'openalex', data: null };
  }

  // Score each result
  let bestScore = 0;
  let bestMatch: (typeof json.results)[0] | null = null;

  for (const author of json.results) {
    const nameSim = nameSimilarity(fullName, author.display_name);

    // Check institution match across current + historical affiliations
    const allInstitutions = [
      ...(author.last_known_institutions ?? []),
      ...(author.affiliations ?? []).map(a => a.institution),
    ].map(i => norm(i?.display_name ?? ''));

    const instSim = allInstitutions.reduce((max, inst) => {
      const sim = nameSimilarity(institutionName, inst);
      return sim > max ? sim : max;
    }, 0);

    // Weighted: name is more important than institution
    const score = nameSim * 0.65 + instSim * 0.35;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = author;
    }
  }

  return {
    verified: bestScore >= AUTO_APPROVE_THRESHOLD,
    score: bestScore,
    source: 'openalex',
    data: bestMatch ? {
      id: bestMatch.id,
      display_name: bestMatch.display_name,
      last_known_institutions: bestMatch.last_known_institutions,
    } : null,
  };
}

// ─── ORCID ────────────────────────────────────────────────────────────────────

/**
 * Fallback: search ORCID public API.
 * Docs: https://info.orcid.org/documentation/api-tutorials/api-tutorial-searching-the-orcid-registry/
 */
async function checkOrcid(
  firstName: string,
  lastName: string,
  institutionName: string,
): Promise<VerificationResult> {
  // ORCID uses Solr query syntax
  const q = `family-name:${encodeURIComponent(lastName)}+AND+given-names:${encodeURIComponent(firstName)}+AND+affiliation-org-name:${encodeURIComponent(institutionName)}`;
  const url = `https://pub.orcid.org/v3.0/search?q=${q}&rows=5`;

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'MyUniReviews/1.0 (admin@myunireviews.com)',
    },
  });

  if (!resp.ok) {
    logger.warn({ status: resp.status }, 'ORCID API error');
    return { verified: false, score: 0, source: 'orcid', data: null };
  }

  const json = await resp.json() as { 'num-found': number; result?: Array<{ 'orcid-identifier': { path: string } }> };

  if (!json['num-found'] || !json.result?.length) {
    return { verified: false, score: 0, source: 'orcid', data: null };
  }

  // ORCID matched by query — treat name+affiliation match as high confidence
  // (the query itself filters by affiliation, so a result = strong signal)
  const orcidId = json.result[0]['orcid-identifier'].path;
  return {
    verified: true,
    score: 0.85,
    source: 'orcid',
    data: { orcid_id: orcidId, matches: json['num-found'] },
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Called after a suggestion is inserted.
 * Runs asynchronously — never throws (errors are caught and logged).
 *
 * If verification succeeds, the suggestion is auto-approved and the professor
 * is inserted into the professors table automatically.
 */
export async function verifySuggestionAsync(suggestion: SuggestionRecord): Promise<void> {
  try {
    const institutionName = await getInstitutionName(suggestion.institution_id);
    if (!institutionName) {
      logger.warn({ suggestionId: suggestion.id }, 'verifySuggestion: institution not found, skipping');
      await pool.query(
        `UPDATE professor_suggestions SET verification_status = 'skipped' WHERE id = $1`,
        [suggestion.id],
      );
      return;
    }

    logger.info(
      { suggestionId: suggestion.id, name: `${suggestion.first_name} ${suggestion.last_name}`, institution: institutionName },
      'Starting professor verification',
    );

    // 1. Try OpenAlex first
    let result = await checkOpenAlex(suggestion.first_name, suggestion.last_name, institutionName);

    // 2. Fallback to ORCID if OpenAlex didn't find them
    if (!result.verified && result.score < AUTO_APPROVE_THRESHOLD) {
      logger.info({ suggestionId: suggestion.id, openAlexScore: result.score }, 'OpenAlex: no match, trying ORCID');
      const orcidResult = await checkOrcid(suggestion.first_name, suggestion.last_name, institutionName);
      if (orcidResult.score > result.score) {
        result = orcidResult;
      }
    }

    logger.info(
      { suggestionId: suggestion.id, source: result.source, score: result.score, verified: result.verified },
      'Verification complete',
    );

    if (result.verified) {
      // ── Auto-approve ──────────────────────────────────────────────────────
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Insert the professor
        const { rows: [prof] } = await client.query(
          `INSERT INTO professors (institution_id, department_id, first_name, last_name, title, email, is_verified)
           VALUES ($1,$2,$3,$4,$5,$6, true) RETURNING id`,
          [
            suggestion.institution_id,
            suggestion.department_id ?? null,
            suggestion.first_name,
            suggestion.last_name,
            suggestion.title ?? 'Lecturer',
            suggestion.email ?? null,
          ],
        );

        // Mark suggestion approved + store verification metadata
        await client.query(
          `UPDATE professor_suggestions
           SET status               = 'approved',
               resolved_at          = NOW(),
               professor_id         = $2,
               verification_status  = 'auto_verified',
               verification_source  = $3,
               verification_score   = $4,
               verification_data    = $5,
               verified_at          = NOW()
           WHERE id = $1`,
          [
            suggestion.id,
            prof.id,
            result.source,
            result.score.toFixed(3),
            JSON.stringify(result.data),
          ],
        );

        await client.query('COMMIT');

        logger.info(
          { suggestionId: suggestion.id, professorId: prof.id, source: result.source, score: result.score },
          'Professor auto-approved',
        );
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // ── Not verified — update metadata but leave in pending queue ─────────
      await pool.query(
        `UPDATE professor_suggestions
         SET verification_status = 'unverifiable',
             verification_source = $2,
             verification_score  = $3,
             verification_data   = $4,
             verified_at         = NOW()
         WHERE id = $1`,
        [
          suggestion.id,
          result.source,
          result.score.toFixed(3),
          JSON.stringify(result.data),
        ],
      );
    }
  } catch (err) {
    // Never let this crash the main request
    logger.error({ err, suggestionId: suggestion.id }, 'Professor verification failed');
  }
}
