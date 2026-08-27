import type { Message, Role } from "../model/messages";

/** A serializable, position-preserving view of one message in a context. */
export interface ContextEntry {
  index: number;
  role: Role;
  content: string;
}

/** Constraints shared by context search and filtering. */
export interface ContextFilter {
  /** Keep only these message roles. Omit to search every role. */
  roles?: readonly Role[];
}

/** Options for a bounded, local full-text context search. */
export interface ContextSearchOptions extends ContextFilter {
  query: string;
  /** Number of matching documents to skip after ranking. */
  offset?: number;
  /** Maximum number of hits to return. Defaults to 10 and is capped at 50. */
  limit?: number;
}

export interface ContextSearchHit extends ContextEntry {
  /** A short window around the best matching term, suitable for a model observation. */
  snippet: string;
  /** BM25-style relevance score; larger means more relevant. */
  score: number;
  /** Query terms that occurred in this message. */
  matchedTerms: string[];
}

export interface ContextSearchResult {
  query: string;
  results: ContextSearchHit[];
  /** Number of hits before offset/limit pagination. */
  total: number;
  offset: number;
  limit: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const SNIPPET_LENGTH = 240;

function messageContent(message: Message): string {
  return typeof message.content === "string" ? message.content : JSON.stringify(message.content);
}

/** Convert messages without losing their original positions in the full context. */
export function contextEntries(messages: readonly Message[]): ContextEntry[] {
  return messages.map((message, index) => ({ index, role: message.role, content: messageContent(message) }));
}

/** Filter context without copying or mutating the original message history. */
export function filterContext(entries: readonly ContextEntry[], filter: ContextFilter = {}): ContextEntry[] {
  if (!filter.roles || filter.roles.length === 0) return [...entries];
  const allowed = new Set(filter.roles);
  return entries.filter((entry) => allowed.has(entry.role));
}

/**
 * Normalise identifiers such as `checkAuth`, ordinary words, and CJK text into
 * searchable terms. CJK characters are deliberately individual terms: there is
 * no whitespace word boundary to rely on, and this keeps the implementation
 * dependency-free for this teaching project.
 */
function terms(text: string): string[] {
  const withIdentifierBoundaries = text.replace(/([a-z\d])([A-Z])/g, "$1 $2").normalize("NFKC").toLocaleLowerCase();
  const chunks = withIdentifierBoundaries.match(/[\p{Script=Han}]+|[\p{L}\p{N}_-]+/gu) ?? [];
  return chunks.flatMap((chunk) => (/^[\p{Script=Han}]+$/u.test(chunk) ? [...chunk] : [chunk]));
}

function boundedInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(0, Math.floor(value!)), maximum);
}

function matchingPosition(content: string, query: string, queryTerms: readonly string[]): number {
  const lowerContent = content.toLocaleLowerCase();
  const full = lowerContent.indexOf(query.toLocaleLowerCase());
  if (full >= 0) return full;
  for (const term of queryTerms) {
    const position = lowerContent.indexOf(term);
    if (position >= 0) return position;
  }
  return 0;
}

function snippet(content: string, position: number): string {
  if (content.length <= SNIPPET_LENGTH) return content;
  const start = Math.max(0, position - Math.floor(SNIPPET_LENGTH / 3));
  const end = Math.min(content.length, start + SNIPPET_LENGTH);
  return `${start > 0 ? "…" : ""}${content.slice(start, end)}${end < content.length ? "…" : ""}`;
}

/**
 * Search the conversation with a small BM25-style scorer.
 *
 * The algorithm is intentionally local and deterministic: it sends no context
 * to a service, ranks rare query terms above common ones, boosts an exact phrase,
 * and returns only a bounded page of snippets. It is a useful teaching bridge
 * before a future vector index, not a semantic-search claim.
 */
export function searchContext(entries: readonly ContextEntry[], options: ContextSearchOptions): ContextSearchResult {
  const query = options.query.trim();
  const offset = boundedInteger(options.offset, 0, Number.MAX_SAFE_INTEGER);
  const limit = boundedInteger(options.limit, DEFAULT_LIMIT, MAX_LIMIT);
  if (!query || limit === 0) return { query, results: [], total: 0, offset, limit };

  const candidates = filterContext(entries, options);
  const queryTerms = [...new Set(terms(query))];
  if (queryTerms.length === 0 || candidates.length === 0) return { query, results: [], total: 0, offset, limit };

  const documents = candidates.map((entry) => ({ entry, terms: terms(entry.content) }));
  const documentFrequency = new Map<string, number>();
  for (const document of documents) {
    for (const term of new Set(document.terms)) {
      if (queryTerms.includes(term)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const averageLength = documents.reduce((sum, document) => sum + document.terms.length, 0) / documents.length || 1;
  const k1 = 1.2;
  const b = 0.75;
  const lowerQuery = query.toLocaleLowerCase();

  const hits = documents.flatMap(({ entry, terms: documentTerms }) => {
    const frequencies = new Map<string, number>();
    for (const term of documentTerms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    const matchedTerms = queryTerms.filter((term) => (frequencies.get(term) ?? 0) > 0);
    if (matchedTerms.length === 0) return [];

    let score = 0;
    for (const term of matchedTerms) {
      const frequency = frequencies.get(term)!;
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      score += idf * (frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * documentTerms.length / averageLength));
    }
    // A complete phrase is usually the most useful signal for source-code names
    // and exact user constraints. BM25 still ranks partial matches beneath it.
    if (entry.content.toLocaleLowerCase().includes(lowerQuery)) score += 3;

    return [{
      ...entry,
      snippet: snippet(entry.content, matchingPosition(entry.content, query, queryTerms)),
      score: Number(score.toFixed(4)),
      matchedTerms,
    }];
  });

  hits.sort((left, right) => right.score - left.score || right.index - left.index);
  return { query, results: hits.slice(offset, offset + limit), total: hits.length, offset, limit };
}
