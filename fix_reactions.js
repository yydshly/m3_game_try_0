const fs = require('fs');
let content = fs.readFileSync('src/ui/render.js', 'utf8');

// 1. Update function signature
content = content.replace(
  'function renderChoiceAftermath(aftermath) {',
  'function renderChoiceAftermath(aftermath, residentVoiceInteraction = null) {'
);

// 2. Replace the reactionsHtml block - find and replace the whole map
const oldBlock = `const reactionsHtml = (residentReactions ?? []).map((r) => \`
    <div class="choice-aftermath__reaction">
      <span class="choice-aftermath__reaction-name">\${escapeHtml(r.residentName ?? "")}：</span>
      <span class="choice-aftermath__reaction-text">\${escapeHtml(r.reaction ?? "")}</span>
    </div>
  \`).join("");`;

if (!content.includes(oldBlock)) {
  console.error('Old block not found');
  // Try to find where residentReactions appears
  const idx = content.indexOf('(residentReactions ?? []).map');
  console.log('map at:', idx);
  if (idx > -1) {
    console.log(JSON.stringify(content.slice(idx - 50, idx + 500)));
  }
  process.exit(1);
}

const newBlock = `// Build reactions with optional MiMo TTS buttons
  const reactionsHtml = (residentReactions ?? []).map((r) => {
    const voiceEnabled = residentVoiceInteraction?.enabled ?? false;
    const audioKey = 'choice_reaction:' + (r.residentId ?? '') + ':' + (aftermath?.id ?? '');
    const btn = voiceEnabled
      ? \`<button class="mimo-tts-btn" data-action="play-mimo-tts" data-audio-key="\${escapeHtml(audioKey)}" data-text="\${escapeHtml(r.reaction ?? '')}" data-scene="choice_reaction" data-resident-id="\${escapeHtml(r.residentId ?? '')}" data-beat-id="">🔈</button>\`
      : '';
    return \`
    <div class="choice-aftermath__reaction">
      <span class="choice-aftermath__reaction-name">\${escapeHtml(r.residentName ?? "")}：</span>
      <span class="choice-aftermath__reaction-text">\${escapeHtml(r.reaction ?? "")}</span>
      \${btn}
    </div>
  \`;
  }).join("");`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('src/ui/render.js', content);
console.log('Done');
