import type { Register } from 'claude-code'

// sala-limpia: keeps the chat clean while a session sits in a room. It only changes the DRAWING: the stored messages,
// the model's context and the turn each room line costs stay exactly as they were (ctrl+o shows everything).
//   - an incoming room line ("[room <name>] ...", delivered by another session) is not drawn;
//   - a reply that is only a short bracketed tag ([sala], [visto], [nada]: the turn had nothing for the owner) is not
//     drawn either. A reply that starts with a tag and goes on is drawn as usual.
const isSilent = (text: string) => /^\[[^\[\]\n]{1,40}\]$/.test(text.trim())
const isRoomLine = (text: string) => /^\s*\[room [^\]]+\]/.test(text)

export const register: Register = on => {
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const { origin, text, isExpanded } = e.props
    if (isExpanded || origin.kind !== 'peer' || !isRoomLine(text)) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!isSilent(e.props.text)) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}
