// Latest-call guard (§17.8 stale-result safety). Async engine round-trips (forward projection,
// reverse sync, validate, execute) can resolve out of order: a slow earlier call may land after a
// faster later one and overwrite fresher session state. Each scope (a store / controller instance)
// keeps a monotonic generation; starting a call bumps it and returns an `isCurrent()` check the
// caller consults after every `await` before committing results. Superseded calls simply drop their
// results — the newest invocation owns the state.

/**
 * Create an independent latest-call guard. `begin(scope)` marks a new call for that scope and
 * returns `isCurrent()`, which is `true` only while no newer call has begun on the same scope.
 * Scopes are held weakly, so per-store generations don't outlive the store.
 */
export function createLatestGuard<S extends object>(): (scope: S) => () => boolean {
  const generation = new WeakMap<S, number>();
  return (scope: S): (() => boolean) => {
    const gen = (generation.get(scope) ?? 0) + 1;
    generation.set(scope, gen);
    return () => generation.get(scope) === gen;
  };
}
