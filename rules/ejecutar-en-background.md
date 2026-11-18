Every command that takes longer than ~30 s (build, suite, e2e, server) runs with `run_in_background`; it is never waited on in the foreground.
