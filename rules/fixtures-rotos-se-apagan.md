# A BROKEN fixture that lives in the DB is switched off when the test ends

If a test seeds into the DB something that the FW compiles or executes at startup (a Tool, a `DBModelRaw`, a Code) and it is broken on purpose, the test deactivates it (`active: false`) or deletes it in its `after`; if it has to be repeated, it is reactivated in the `before`.

A startup log with known errors trains people to ignore the log. An old fixture that dirties the startup is switched off with `active: false` without telling anyone: it is cleanup.
