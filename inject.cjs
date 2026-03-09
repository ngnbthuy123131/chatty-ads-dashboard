const fs = require('fs');
const path = require('path');
const data = fs.readFileSync(path.join(__dirname,'ads-data','history.json'),'utf8');
const template = fs.readFileSync(path.join(__dirname,'template.html'),'utf8');
const out = template.replace('"__DATA__"', data);
fs.writeFileSync(path.join(__dirname,'index.html'), out);
console.log('index.html:', fs.statSync(path.join(__dirname,'index.html')).size, 'bytes');
