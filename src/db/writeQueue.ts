// Runs database writes one at a time, in the order they were requested.
// Marking is multi-step (find/create session, then insert/delete), so a fast
// absent→present double tap must not interleave, and nothing may slip into a
// roster-save transaction.

let tail: Promise<unknown> = Promise.resolve();

export function serializeWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => undefined);
  return run;
}

/** Runs a read after every write queued so far, so it sees their results. */
export const afterPendingWrites = serializeWrite;
