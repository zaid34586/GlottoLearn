// One-off codemod: dark theme classes -> light theme classes
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');

const map = [
  ['text-white/90', 'text-slate-800'],
  ['text-white/85', 'text-slate-800'],
  ['text-white/80', 'text-slate-700'],
  ['text-white/75', 'text-slate-700'],
  ['text-white/70', 'text-slate-600'],
  ['text-white/65', 'text-slate-600'],
  ['text-white/60', 'text-slate-500'],
  ['text-white/55', 'text-slate-500'],
  ['text-white/50', 'text-slate-500'],
  ['text-white/45', 'text-slate-400'],
  ['text-white/40', 'text-slate-400'],
  ['text-white/35', 'text-slate-400'],
  ['text-white/30', 'text-slate-300'],
  ['text-white/25', 'text-slate-300'],
  ['text-white/15', 'text-slate-200'],
  ['text-white/10', 'text-slate-200'],
  ['text-white', 'text-slate-900'],
  ['bg-white/4', 'bg-slate-50'],
  ['bg-white/5', 'bg-slate-100'],
  ['bg-white/8', 'bg-slate-100'],
  ['bg-white/10', 'bg-slate-100'],
  ['bg-white/15', 'bg-slate-200'],
  ['bg-white/20', 'bg-slate-200'],
  ['border-white/5', 'border-slate-100'],
  ['border-white/10', 'border-slate-200'],
  ['border-white/15', 'border-slate-200'],
  ['border-white/20', 'border-slate-200'],
  ['border-white/25', 'border-slate-300'],
  ['text-indigo-200', 'text-indigo-600'],
  ['text-indigo-300', 'text-indigo-600'],
  ['text-fuchsia-300', 'text-fuchsia-600'],
  ['text-emerald-300', 'text-emerald-600'],
  ['text-amber-300/80', 'text-amber-600'],
  ['text-amber-300/70', 'text-amber-600'],
  ['text-amber-300', 'text-amber-600'],
  ['text-red-300/80', 'text-red-600'],
  ['text-red-300', 'text-red-600'],
  ['text-sky-300', 'text-sky-600'],
  ['text-teal-300', 'text-teal-600'],
  ['bg-black/60', 'bg-slate-900'],
  ['bg-black/70', 'bg-slate-900/70'],
  ['text-amber-200', 'text-amber-600'],
];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (p.includes('classroom')) continue; // keep video room dark
      walk(p);
    } else if (/\.(tsx?|css)$/.test(f)) {
      let src = fs.readFileSync(p, 'utf8');
      let changed = false;
      for (const [from, to] of map) {
        if (src.includes(from)) {
          src = src.split(from).join(to);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(p, src);
        console.log('updated', path.relative(root, p));
      }
    }
  }
}
walk(root);
console.log('done');
