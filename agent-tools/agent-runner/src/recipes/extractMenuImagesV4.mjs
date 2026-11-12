import v2 from "./extractMenuImagesV2.mjs";
import v3 from "./extractMenuImagesV3.mjs";

// v3 with the OCR demoted from a second reader to an alarm: the agent's own reading is the text, the OCR only says where to look again.
// Not merged with v3 on purpose: v3 is the control of this change.
const AIDS = `Two aids, to use only to check your own reading:
- OCR: it is an ALARM, never a source. Next to each photo there can be a file <photo>.ocr.txt (for example in/menu-1.jpeg.ocr.txt) with what a plain OCR program read from that photo, in the page's reading order. Your own reading of the photo is the menu text; you read it first and you decide it. After you have read ALL the photos and formed the menu in your mind, read the .ocr.txt files with the Read tool and use them only to find places to look again: where the OCR's words or numbers differ from yours, look at that word in the photo once more and keep what you clearly see. Never copy a word, a number or a symbol from the OCR into the menu.
  The OCR is wrong in known ways: it drops or repeats digits of a price, it changes a letter or an accent (a word that does not exist in the menu's language is the OCR's mistake, not the menu's), and it swaps symbols (° read as * or %). When you look again and still cannot tell, keep your reading and write in doubt what you read and what the OCR read. Never write in doubt that a word "is printed" in some way unless you looked at that word again in the photo. If a photo has no .ocr.txt there was no OCR for it.
- WebSearch: use it ONLY when a word is unknown to you and you need its meaning or its real spelling (a dish term, a brand), with one short query for that single word, never the menu or a list of dishes. What the web says never changes what is printed: the text is copied as printed, and you write in doubt what you searched and what you found.
The photo is the authority; the OCR and the web only help you check your reading.`;

export default {
  ...v3,
  name: "extractMenuImagesV4",
  systemPrompt: (ctx) => v2.systemPrompt(ctx).replace("Write exactly two files", `${AIDS}\n\nWrite exactly two files`)
};
