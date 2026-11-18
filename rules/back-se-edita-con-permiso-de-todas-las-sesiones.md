# Each session tests against ITS OWN back; the normal back no longer restarts on save

Editing does not take the lab: the normal back (`-C dev`) does not watch files. Whoever tests starts their own back:

```
~/bin/back-solo.sh start dev <site> [--ttl min]   # JSON: url, log, pid, site, ends, plugins, env
<env that answered> <your suite>
~/bin/back-solo.sh stop [site]                    # bring it down when done; it weighs ~500 MB and expires after 2 h
~/bin/back-solo.sh list                           # the ones that are up
```

- 🔴 **Saving restarts nothing.** The normal back runs the code of the last restart. Testing against it without restarting is testing old code, with no error at all. Your own back does not reload either: `stop` and `start`.
- **`plugins` in the `start` response**: if you depend on a plugin that another session is touching, ask its owner.
- **The DB is the site's**: your own back is one more worker on that data. A half-edited schema can change that model's indexes until the next restart of the normal one; this is accepted.
- **The MCP still goes against the normal back**: a new endpoint or model gets a 404 from it until it is published. That is tested by suite.

## The lab is left only for publishing to the normal back

```
~/bin/lab.sh take "<what I am going to do>" [minutes=45]   # free: TAKEN at once. Busy: QUEUED and it comes back
~/bin/back-restart.sh                                # requires the lab; restarts, records the time and waits for it to answer
~/bin/lab.sh mine && <final test through nginx>      # exit 0 only if the lab is yours
~/bin/lab.sh release "<what I did>"
~/bin/back-restart.sh includes <file>                # exit 0 if your change already went in: do not ask for another restart
```

- **It is used for**: restarting the normal one (also for `.itdfw.js` and `/etc/itdfw/`) and the final test through nginx with the SW active, mandatory for anything that touches the SW. Everything else is tested on your own back, without the lab.
- 🔴 **Only `✅ LAB TOMADO` means it is yours.** `⏳ EN FILA` (exit 3) does not: when it is your turn you get the message. No "is it free?" messages: do `take` and move on to something else. Take only what you need and release it saying what was done.
- Someone else's restart can bring in someone's half-finished code; when everyone finishes it ends up fine.
- `includes` only sees the restarts recorded by the script: one done with `rs` in the panel does not count.

Siblings: `lab-compartido-el-que-modifica-prueba-primero`, `core-por-mensaje-a-core`, `base-de-pruebas-comun`.
