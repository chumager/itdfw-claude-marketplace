Every command that takes longer than ~30 s (build, suite, e2e, server) runs with `run_in_background`; it is never waited on in the foreground.

- 🔴 **10 minutes is the ceiling of any run.** The user timer `cajaritos-shell-tope.timer` ends, every minute, any tool shell running for more than 11 minutes, with everything it started (`~/.claude/state/shell-tope.log`). A suite takes 2 or 3 minutes; what needs longer is badly made.
- A server for tests is not a background shell: `back-solo.sh start` returns at once and the back carries its own `--ttl`.
- Waiting for something is a signal (`notify_when_idle`, the task notification, a `Monitor` with its own timeout), never an `until … sleep` loop in the background.
