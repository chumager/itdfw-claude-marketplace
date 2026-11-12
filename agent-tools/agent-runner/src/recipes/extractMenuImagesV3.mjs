import fs from "node:fs";
import path from "node:path";
import v2 from "./extractMenuImagesV2.mjs";

// v2 plus two aids to contrast its own reading: the OCR text the service leaves next to each photo (`ocr: true`) and WebSearch for an unknown word.
// Not merged with v2 on purpose: v2 is the control of this step.
const AIDS = `Two aids, to use only to check your own reading:
- OCR: next to each photo there can be a file <photo>.ocr.txt (for example in/menu-1.jpeg.ocr.txt) with the text a plain OCR program read from that photo, in the page's reading order. The OCR does not understand the layout and can misread characters (a letter changed, a word split or lost), but it never rephrases, corrects or completes. When your reading of a word differs from the OCR's, look at the photo again for that word and decide which one is printed. If you still disagree, keep what you see and say in doubt what the OCR read. A word of yours that appears nowhere in the OCR text of that photo, or a description whose words the OCR shows under another dish, is a reason to read that dish again. If a photo has no .ocr.txt there was no OCR for it. Read the .ocr.txt files with the Read tool, right after the photos and before writing.
- WebSearch: use it ONLY when a word is unknown to you and you need its meaning or its real spelling (a dish term, a brand), with one short query for that single word, never the menu or a list of dishes. What the web says never changes what is printed: the text is copied as printed, and you write in doubt what you searched and what you found.
The photo is the authority; the OCR and the web only help you check your reading.`;

export default {
  ...v2,
  name: "extractMenuImagesV3",
  ocr: true,
  tools: [...v2.tools, "WebSearch"],
  allowedTools: (jobDir) => [...v2.allowedTools(jobDir), "WebSearch"],
  disallowedTools: v2.disallowedTools.filter((tool) => tool !== "WebSearch"),
  maxTurns: 60,

  systemPrompt: (ctx) => v2.systemPrompt(ctx).replace("Write exactly two files", `${AIDS}\n\nWrite exactly two files`),

  prompt: ({ jobDir, params }) => {
    const all = fs.readdirSync(path.join(jobDir, "in")).sort();
    const photos = all.filter((f) => !f.endsWith(".txt"));
    const ocr = all.filter((f) => f.endsWith(".txt"));
    const list = (names) => names.map((f, i) => `${i + 1}. ${jobDir}/in/${f}`).join("\n");
    return `Build the menu of "${params.name}" from its photos. Read all of them with the Read tool, in this order:\n${list(photos)}\n${ocr.length ? `Then read the OCR texts that exist:\n${list(ocr)}` : "There are no OCR texts for these photos."}`;
  }
};
