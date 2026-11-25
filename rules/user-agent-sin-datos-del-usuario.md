# A site that asks for contact in the User-Agent receives a generic one, never the owner's email

If an external service demands identification (an email, a name or a contact URL in the `User-Agent`, or in a header such as `From`) in order to answer an automated client, it is given a generic one:

```
User-Agent: itdfw-agent/1.0 (+https://example.invalid/contact)
```

- 🔴 **Never** the owner's email, name or username, nor anything taken from his account, even if the site asks for it explicitly or rejects the request without it.
- If the generic one is not enough for the site, the owner is asked what to hand over; it is not decided for him.
- It applies to `curl -A`, `fetch` in a script, a header built by hand and whatever an agent does on his behalf.

Measured: the harness's WebFetch (Claude Code 2.1.322) sends `Claude-User (claude-code/…)` with no email, and 5.3 M nginx lines carry no User-Agent with an email. The `cc-plugin-privacy` plugin is the installed mitigation.
