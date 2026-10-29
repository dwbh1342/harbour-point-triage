// Word count per "## " section of a markdown file, excluding code fences and tables' pipes.
const fs = require('fs');
const md = fs.readFileSync(process.argv[2], 'utf8').replace(/```[\s\S]*?```/g, '');
for (const sec of md.split(/^## /m).slice(1)) {
  const title = sec.split('\n')[0];
  const words = sec.replace(/[|*#`-]/g, ' ').split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  console.log(String(words).padStart(4), words > 300 ? 'OVER' : 'ok  ', title);
}
