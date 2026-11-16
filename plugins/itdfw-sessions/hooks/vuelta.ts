import type { Register } from 'claude-code'

// vuelta: a message from another session must be answered to that session, not only reported to the person.
//   - a message from a session opens a debt on the receiver (bin/vuelta.sh, a ledger shared by every session);
//   - the receiver's answer closes it, and reaching the asker it reads as a reply, so it opens no opposite debt;
//   - a turn that ends with a debt still open gets a reminder as a new prompt, so the answer never waits for the
//     person to come back.
// A sender written `<kind>:<name>` (cron:briefing, hook:hilo, script:lab, room:QA, broadcast:<user>) is external, not
// a session: nobody answers it and it opens no debt. `uds:` is the one prefix that IS a session, the socket address
// SendMessage stamps.
const isExternal = (address: string, name: string) => name.includes(':') || (/^[a-z-]+:/.test(address) && !address.startsWith('uds:'))

let me: string | null = null

async function ledger($: any, ...args: string[]): Promise<string> {
  try {
    const r = await $.process.run([`${$.plugin.root}/bin/vuelta.sh`, ...args])
    return String(r.stdout ?? '').trim()
  } catch {
    return '' // the ledger never blocks a delivery
  }
}

/** The name of this session, read once from its session file (the shell's parent is the Claude process). */
async function myName($: any): Promise<string> {
  if (me !== null) return me
  try {
    const r = await $.process.run(['bash', '-c', '"$1" name "$PPID"', '_', `${$.plugin.root}/bin/vuelta.sh`])
    me = String(r.stdout ?? '').trim()
  } catch {
    me = ''
  }
  return me ?? ''
}

/** The session a shell command writes to with the session script, when it is one. */
const scriptRecipient = (command: string) => {
  const m = /claude-session-msg\.sh\s+(?:"([^"]+)"|'([^']+)'|(\S+))/.exec(command)
  return m ? (m[1] ?? m[2] ?? m[3]) : null
}

export const register: Register = on => {
  on('session.receive', async ($, e, next) => {
    if (e.origin.kind !== 'peer') return next(e)
    const self = await myName($)
    const from = /from-name="([^"]+)"/.exec(e.text)?.[1]
    const address = /from="([^"]+)"/.exec(e.text)?.[1] ?? ''
    if (!self || !from || from === self || isExternal(address, from)) return next(e)
    const kind = await ledger($, 'receive', self, from)
    if (kind !== 'request') return next(e)
    return next({ ...e, text: `${e.text}\n[vuelta] ${from} opened this: when you finish, send the result to ${from} with SendMessage, besides what you tell the person.` })
  })

  // an answer by SendMessage: recorded before it leaves, so it arrives already known as a reply
  on('session.send', async ($, e, next) => {
    const self = await myName($)
    if (self) await ledger($, 'sent', self, e.to)
    return next(e)
  })

  // an answer through the session script, sent from a shell command
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const to = scriptRecipient(String((e as any).input?.command ?? ''))
    if (to) {
      const self = await myName($)
      if (self) await ledger($, 'sent', self, to)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return result
    const self = await myName($)
    if (!self) return result
    const owed = (await ledger($, 'pending', self)).split('\n').filter(Boolean)
    if (owed.length > 0) {
      // not awaited: a plugin's prompt runs once the session is idle, after this hook returns
      void $.prompt
        .submit({ text: `[vuelta] You closed the turn without answering ${owed.join(', ')}. Send the result now with SendMessage (one message per sender): they are waiting for it.` })
        .catch(() => {})
    }
    return result
  })
}
