# At the end of the day: audit the `.bak` / `.old` files and offer to delete them

```
find . -name "*.bak" -o -name "*.old" -o -name "*.orig"   # excluding node_modules
```

For each one:
1. Compare against the live file: what changed and whether what is in the backup survives somewhere.
2. Fully covered (it lives in the code or in git) → OFFER to delete it, with the analysis in view.
3. Not covered → say so and do not delete: that is the finding.

🔴 It is offered, not deleted (`verify-then-destroy`). An old backup contaminates searches: a grep finds the old version and takes it as current.
