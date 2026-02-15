import { HEADER_CANDIDATES } from "../config/constants.js";
import { normalizeHeaderToken } from "./normalizer.js";

export type HeaderCandidateMap = typeof HEADER_CANDIDATES;
export type HeaderMap = Record<keyof HeaderCandidateMap, number>;

export const findHeader = (headers: string[], candidates: readonly string[]): number => {
  if (headers.length === 0) {
    return -1;
  }

  for (const name of candidates) {
    const idx = headers.indexOf(name);
    if (idx !== -1) {
      return idx;
    }
  }

  const normalizedHeaders = headers.map((h) => normalizeHeaderToken(h));
  for (const candidate of candidates) {
    const normalized = normalizeHeaderToken(candidate);
    const exactIdx = normalizedHeaders.indexOf(normalized);
    if (exactIdx !== -1) {
      return exactIdx;
    }
    const partialIdx = normalizedHeaders.findIndex((h) => h.includes(normalized));
    if (partialIdx !== -1) {
      return partialIdx;
    }
  }
  return -1;
};

export const createHeaderMap = (headers: string[]): HeaderMap => {
  const map = {} as HeaderMap;
  (Object.keys(HEADER_CANDIDATES) as Array<keyof HeaderCandidateMap>).forEach((key) => {
    map[key] = findHeader(headers, HEADER_CANDIDATES[key]);
  });
  return map;
};
