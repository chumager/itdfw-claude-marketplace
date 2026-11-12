import v2 from "./extractMenuImagesV2.mjs";
import v3 from "./extractMenuImagesV3.mjs";

// v4 with the OCR choice left to the agent: the service leaves two OCR readings (own size and enlarged) and the agent judges, per photo, how far they help.
// Not merged with v4 on purpose: v4 is the control of this change.
const AIDS = `Two aids, to use only to check your own reading:
- OCR: it is an ALARM, never a source. Next to each photo there can be two files with what a plain OCR program read from it, in the page's reading order: <photo>.ocr.txt (read at the photo's own size) and, when the photo's text is small, <photo>.ocr-scaled.txt (the same photo enlarged). Neither is better by definition: enlarging can read worse. Menus come in any shape (landscape, portrait, dark or light, glare), so before you rely on the OCR, look at the photo yourself and judge how far it can help on THIS photo (how big the text is, the contrast, the angle). Say in one line of report.md how reliable it looked and in what way it failed (digits of a price, accents, symbols, whole lines).
  Your own reading of the photo is the menu text; you read it first and you decide it. After you have read ALL the photos and formed the menu in your mind, read the OCR files with the Read tool and use them only to find places to look again: where the OCR files disagree with you or with each other, look at that word in the photo once more and keep what you clearly see. When both OCR files agree with each other and differ from you, that is a strong reason to look again, not to copy. Never copy a word, a number or a symbol from the OCR into the menu.
  The OCR is wrong in known ways: it drops or repeats digits of a price, it loses or adds accents (an accent is a tiny mark: decide it only by looking at the photo, and if you cannot tell, say so in doubt), it changes a letter (a word that does not exist in the menu's language is the OCR's mistake, not the menu's), and it swaps symbols (° read as * or %). Never write in doubt that a word "is printed" in some way unless you looked at that word again in the photo. If a photo has no OCR file there was no OCR for it.
- WebSearch: use it ONLY when a word is unknown to you and you need its meaning or its real spelling (a dish term, a brand), with one short query for that single word, never the menu or a list of dishes. What the web says never changes what is printed: the text is copied as printed, and you write in doubt what you searched and what you found.
The photo is the authority; the OCR and the web only help you check your reading.`;

export default {
  ...v3,
  name: "extractMenuImagesV5",
  systemPrompt: (ctx) => v2.systemPrompt(ctx).replace("Write exactly two files", `${AIDS}\n\nWrite exactly two files`)
};
