import { promises as fs } from 'node:fs';
import path from 'node:path';

type RawPoint = { type: string; json: any; dateTime: Date };

async function readOptionalFile(file: string) {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return null;
  }
}

async function readFirstExisting(candidates: string[]) {
  for (const file of candidates) {
    const value = await readOptionalFile(file);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function parseRecordedPoint(line: string): RawPoint | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      type?: unknown;
      json?: unknown;
      dateTime?: unknown;
      A?: unknown;
    } | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (
      typeof parsed.type === 'string' &&
      'dateTime' in parsed &&
      (parsed as { json?: unknown }).json !== undefined
    ) {
      const dateTime = new Date(String(parsed.dateTime));
      if (!Number.isFinite(dateTime.getTime())) {
        return null;
      }
      return {
        type: parsed.type,
        json: (parsed as { json?: unknown }).json ?? null,
        dateTime,
      };
    }

    if (!Array.isArray(parsed.A) || parsed.A.length < 3) {
      return null;
    }

    const [type, json, recordedAt] = parsed.A;
    if (typeof type !== 'string') {
      return null;
    }

    const dateTime = new Date(String(recordedAt));
    if (!Number.isFinite(dateTime.getTime())) {
      return null;
    }

    return {
      type,
      json: json ?? null,
      dateTime,
    };
  } catch {
    return null;
  }
}

type TopicView = {
  latest: RawPoint | null;
  timeline: (from?: Date, to?: Date) => RawPoint[];
};

export type SessionStore = {
  raw: {
    subscribe: any;
    live: RawPoint[];
    download: any | null;
    keyframes: any | null;
  };
  topic: (name: string) => TopicView;
};

export async function loadSessionStore(dir: string): Promise<SessionStore> {
  const subscribeText = await readFirstExisting([
    path.join(dir, 'subscribe.json'),
    path.join(dir, 'subscribe.txt'),
  ]);
  if (subscribeText === null) {
    throw new Error(`Could not find subscribe.json or subscribe.txt in ${dir}`);
  }
  const subscribeRaw = JSON.parse(subscribeText);
  let downloadRaw: any | null = null;
  try {
    downloadRaw = JSON.parse(
      await fs.readFile(path.join(dir, 'download.json'), 'utf-8'),
    );
  } catch {
    downloadRaw = null;
  }
  let keyframesRaw: any | null = null;
  try {
    keyframesRaw = JSON.parse(
      await fs.readFile(path.join(dir, 'keyframes.json'), 'utf-8'),
    );
  } catch {
    keyframesRaw = null;
  }
  const liveText = await readFirstExisting([
    path.join(dir, 'live.jsonl'),
    path.join(dir, 'live.txt'),
  ]);
  if (liveText === null) {
    throw new Error(`Could not find live.jsonl or live.txt in ${dir}`);
  }
  const liveLines = liveText
    .split(/\r?\n/)
    .map((line) => parseRecordedPoint(line))
    .filter((point): point is RawPoint => point !== null);

  const byTopic = new Map<string, RawPoint[]>();
  for (const p of liveLines) {
    const arr = byTopic.get(p.type) ?? [];
    arr.push(p);
    byTopic.set(p.type, arr);
  }
  for (const arr of byTopic.values()) {
    arr.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
  }

  return {
    raw: {
      subscribe: subscribeRaw,
      live: liveLines,
      download: downloadRaw,
      keyframes: keyframesRaw,
    },
    topic: (name: string) => {
      const arr = byTopic.get(name) ?? [];
      return {
        latest: arr.length > 0 ? arr[arr.length - 1] : null,
        timeline: (from?: Date, to?: Date) =>
          arr.filter(
            (p) => (!from || p.dateTime >= from) && (!to || p.dateTime <= to),
          ),
      };
    },
  };
}
