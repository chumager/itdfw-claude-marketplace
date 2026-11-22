Every command that takes longer than ~30 s (build, suite, e2e, server) runs with `run_in_background`; it is never waited on in the foreground.

- 🔴 **10 minutes is the ceiling of any run.** The hook `background-timeout.sh` wraps every background command line in `timeout -k 10 600 bash -c '…'` (exit 124 = cut). A suite takes 2 or 3 minutes; what needs longer is badly made.
- A server for tests is not a background shell: `back-solo.sh start` returns at once and the back carries its own `--ttl`.
- Waiting for something is a signal (`notify_when_idle`, the task notification, a `Monitor` with its own timeout), never an `until … sleep` loop in the background.
