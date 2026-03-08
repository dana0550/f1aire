import { isPlainObject } from './processors/merge.js';
import { resolveStaticAssetUrl } from './team-radio.js';

export type StreamMetadataTopic = 'AudioStreams' | 'ContentStreams';

export type StreamMetadataRecord = {
  streamId: string;
  name: string | null;
  language: string | null;
  type: string | null;
  uri: string | null;
  path: string | null;
  resolvedUrl: string | null;
};

function compareMaybeNumericStrings(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOrderedEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.map((entry, index) => [String(index), entry]);
  }
  if (!isPlainObject(value)) {
    return [];
  }
  return Object.entries(value)
    .filter(([key]) => key !== '_kf')
    .sort(([left], [right]) => compareMaybeNumericStrings(left, right));
}

function getStreamsRoot(state: unknown): unknown {
  if (isPlainObject((state as { Streams?: unknown } | null)?.Streams)) {
    return (state as { Streams: unknown }).Streams;
  }
  if (Array.isArray((state as { Streams?: unknown } | null)?.Streams)) {
    return (state as { Streams: unknown }).Streams;
  }
  return null;
}

function buildStreamMetadataRecord(opts: {
  streamId: string;
  raw: unknown;
  staticPrefix?: string | null;
}): StreamMetadataRecord | null {
  if (!isPlainObject(opts.raw)) {
    return null;
  }

  const uri = toOptionalString(opts.raw.Uri);
  const path = toOptionalString(opts.raw.Path);

  return {
    streamId: opts.streamId,
    name: toOptionalString(opts.raw.Name),
    language: toOptionalString(opts.raw.Language),
    type: toOptionalString(opts.raw.Type),
    uri,
    path,
    resolvedUrl: resolveStaticAssetUrl(opts.staticPrefix ?? null, uri ?? path),
  };
}

function matchesFilter(value: string | null, filter: string | null) {
  if (!filter) {
    return true;
  }
  if (!value) {
    return false;
  }
  return value.toLowerCase().includes(filter.toLowerCase());
}

export function getStreamMetadataRecords(opts: {
  topic: StreamMetadataTopic;
  state?: unknown;
  staticPrefix?: string | null;
  language?: string | null;
  search?: string | null;
}): StreamMetadataRecord[] {
  const languageFilter = toOptionalString(opts.language);
  const searchFilter = toOptionalString(opts.search);

  return toOrderedEntries(getStreamsRoot(opts.state))
    .map(([streamId, raw]) =>
      buildStreamMetadataRecord({
        streamId,
        raw,
        staticPrefix: opts.staticPrefix,
      }),
    )
    .filter((record): record is StreamMetadataRecord => record !== null)
    .filter((record) => {
      if (!matchesFilter(record.language, languageFilter)) {
        return false;
      }
      if (!searchFilter) {
        return true;
      }
      return [
        record.name,
        record.language,
        record.type,
        record.uri,
        record.path,
        record.resolvedUrl,
      ].some((value) => matchesFilter(value, searchFilter));
    });
}
