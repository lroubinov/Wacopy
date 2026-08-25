export type SharedState = { text: string; updatedAt: string | null; version: number };

const globalStore = globalThis as typeof globalThis & { sharedTextState?: SharedState };
const TEN_MINUTES = 10 * 60 * 1000;

export function getSharedState(): SharedState {
  globalStore.sharedTextState ??= { text: '', updatedAt: null, version: 0 };
  const state = globalStore.sharedTextState;
  if (state.updatedAt && Date.now() - new Date(state.updatedAt).getTime() >= TEN_MINUTES) {
    globalStore.sharedTextState = { text: '', updatedAt: null, version: state.version + 1 };
  }
  return globalStore.sharedTextState;
}

export function setSharedText(text: string): SharedState {
  const next: SharedState = {
    text: text.trim(),
    updatedAt: new Date().toISOString(),
    version: getSharedState().version + 1,
  };
  globalStore.sharedTextState = next;
  return next;
}

export function clearSharedText(expectedVersion: number) {
  const current = getSharedState();
  if (current.version !== expectedVersion) return { cleared: false, state: current };
  const next: SharedState = { text: '', updatedAt: null, version: current.version + 1 };
  globalStore.sharedTextState = next;
  return { cleared: true, state: next };
}
