const { PDFExtract } = require('pdf.js-extract');
const fs = require('fs');
const pdfExtract = new PDFExtract();
const options = {};
let out = '';

async function run() {
  const files = ['GDR44-English.pdf', 'HVW18-Eng.pdf', 'T8231-0920.pdf'];
  for (const f of files) {
    if (fs.existsSync(f)) {
      out += `\n\n--- ${f} ---\n\n`;
      try {
        const data = await pdfExtract.extract(f, options);
        data.pages.forEach(p => {
          out += p.content.map(c => c.str).join(' ') + '\n';
        });
      } catch (e) { out += 'Error: ' + e; }
    }
  }
  fs.writeFileSync('pdf_rules_extracted.txt', out);
  console.log('Done');
}
run();
