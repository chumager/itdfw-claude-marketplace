# ACCESS ≠ CAPABILITY — never open the whole resource to enable one action

"Anyone can do X" describes a bounded capability, never lowering the access of the whole resource (model, pipeline, endpoint, bucket, repo).

1. **Identify the exact capability** and expose it through its OWN endpoint, with its own permission.
2. **The resource keeps its access.** A model with third-party data is never `isAnonymous`.
3. **Cross permission × verbs**: `isAnonymous` + all 4 verbs = CRUD open to the internet. If something is anonymous, each verb has to be justified.
4. **Data litmus**: if the result does not persist, the endpoint does not touch the DB. If it persists, it requires identity (a document without an owner is born garbage).
   In ITDFW: anonymous capability → `schema.options.API` or an endpoint in `APP/`, never `isAnonymous` on the model (skill `itdfw-api-system`).

## Red flag
Touching the permission of the RESOURCE (`isAnonymous`, `auth: false`, chmod 777, public bucket) to enable something → STOP.

## Do not over-correct in the wrong layer
- **Access** (AAA/profile): who gets in and with which verbs.
- **Scope** (`query`): business rule ("I only see mine"), not security. Putting default-deny on it breaks the profiles.

Fix the right vector; hardening the neighbors is debt disguised as prudence.
