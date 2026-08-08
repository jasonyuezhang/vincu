// COMPAT(paseoOwnedWorktreeRename): renamed in v0.3.0 (paseo→vincu).
// Remove after 2027-02-08 once daemon floor >= v0.3.0.
//
// zod-aot validates structure but does not run Zod transforms, so old daemons
// that still send `isPaseoOwnedWorktree` need an explicit rename pass here.

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const normalized = normalizeValue(item);
      changed ||= normalized !== item;
      return normalized;
    });
    return changed ? next : value;
  }

  if (value == null || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  let changed = false;
  const next: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(record)) {
    if (key === "isPaseoOwnedWorktree") {
      changed = true;
      continue;
    }
    const normalizedChild = normalizeValue(child);
    changed ||= normalizedChild !== child;
    next[key] = normalizedChild;
  }

  if ("isPaseoOwnedWorktree" in record && !("isVincuOwnedWorktree" in record)) {
    next.isVincuOwnedWorktree = record.isPaseoOwnedWorktree;
    changed = true;
  }

  return changed ? next : value;
}

export function normalizePaseoOwnedWorktreeMessage<T>(message: T): T {
  return normalizeValue(message) as T;
}
