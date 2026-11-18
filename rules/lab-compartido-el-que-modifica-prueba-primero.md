# Publishing to the normal back: whoever MODIFIES tests first on their own back, and only then restarts

A change by one session is not sent to another "so it tests it":

1. Whoever changed the code runs THEIR complete suite on their own back (`back-solo.sh`), until N/N green.
2. If the normal back has to see it: `lab.sh take`, `back-restart.sh`, final test if it touches the SW, and `lab.sh release "<what changed, N/N>"`.
3. The other session tests on its own back with the tree's code, or against the normal one if `back-restart.sh includes <file>` confirms it.

A red from a collision costs the same to read as a real one and says nothing.

Sibling: `back-se-edita-con-permiso-de-todas-las-sesiones`.
