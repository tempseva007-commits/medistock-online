// Dependency-free, minimal OOXML (.xlsx) reader/writer for MediStock workbooks.
// Supports inline/shared strings and ZIP stored/deflate entries; exported sheets are standard OOXML.
function xmlEsc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function colName(n) { let s=''; while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s; }
function sheetXml(rows) {
  const out=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'];
  rows.forEach((row,ri)=>{out.push(`<row r="${ri+1}">`);row.forEach((value,ci)=>{if(value===null||value===undefined||value==='')return;const cell=colName(ci+1)+(ri+1);if(typeof value==='number'&&Number.isFinite(value))out.push(`<c r="${cell}"><v>${value}</v></c>`);else out.push(`<c r="${cell}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(value)}</t></is></c>`);});out.push('</row>');});
  out.push('</sheetData></worksheet>');return out.join('');
}
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function zipFiles(files){
  const enc=new TextEncoder(),local=[],central=[];let offset=0;
  for(const file of files){
    const name=enc.encode(file.name),data=enc.encode(file.data),crc=crc32(data);
    const lh=new Uint8Array(30+name.length+data.length),ld=new DataView(lh.buffer);
    ld.setUint32(0,0x04034b50,true);ld.setUint16(4,20,true);ld.setUint16(6,0,true);ld.setUint16(8,0,true);ld.setUint16(10,0,true);ld.setUint16(12,0,true);ld.setUint32(14,crc,true);ld.setUint32(18,data.length,true);ld.setUint32(22,data.length,true);ld.setUint16(26,name.length,true);ld.setUint16(28,0,true);lh.set(name,30);lh.set(data,30+name.length);local.push(lh);
    const ch=new Uint8Array(46+name.length),cd=new DataView(ch.buffer);
    cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);cd.setUint16(8,0,true);cd.setUint16(10,0,true);cd.setUint16(12,0,true);cd.setUint16(14,0,true);cd.setUint32(16,crc,true);cd.setUint32(20,data.length,true);cd.setUint32(24,data.length,true);cd.setUint16(28,name.length,true);cd.setUint16(30,0,true);cd.setUint16(32,0,true);cd.setUint16(34,0,true);cd.setUint16(36,0,true);cd.setUint32(38,0,true);cd.setUint32(42,offset,true);ch.set(name,46);central.push(ch);offset+=lh.length;
  }
  const centralSize=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),ed=new DataView(end.buffer);
  ed.setUint32(0,0x06054b50,true);ed.setUint16(4,0,true);ed.setUint16(6,0,true);ed.setUint16(8,files.length,true);ed.setUint16(10,files.length,true);ed.setUint32(12,centralSize,true);ed.setUint32(16,offset,true);ed.setUint16(20,0,true);
  return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function writeXlsx(sheets){
  const list=sheets.map(s=>({name:s.name,rows:s.rows||[]}));
  const sheetNodes=list.map((s,i)=>`<sheet name="${xmlEsc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('');
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetNodes}</sheets></workbook>`;
  const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`;
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${list.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  return zipFiles([{name:'[Content_Types].xml',data:contentTypes},{name:'_rels/.rels',data:rootRels},{name:'xl/workbook.xml',data:workbook},{name:'xl/_rels/workbook.xml.rels',data:workbookRels},...list.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s.rows)}))]);
}
export function downloadXlsx(sheets,filename){const blob=writeXlsx(sheets),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
function parseXml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('Excel workbookમાં invalid XML છે.');return doc;}
function colIndex(ref){const letters=String(ref||'').match(/^[A-Z]+/i)?.[0]?.toUpperCase()||'A';let n=0;for(const c of letters)n=n*26+c.charCodeAt(0)-64;return n-1;}
function parseSheet(xml,shared){const doc=parseXml(xml),out=[];for(const rowEl of Array.from(doc.getElementsByTagName('row'))){const row=[];for(const c of Array.from(rowEl.getElementsByTagName('c'))){const index=colIndex(c.getAttribute('r'));const type=c.getAttribute('t');let value='';if(type==='inlineStr')value=Array.from(c.getElementsByTagName('t')).map(t=>t.textContent||'').join('');else{const v=c.getElementsByTagName('v')[0]?.textContent??'';value=type==='s'?(shared[Number(v)]??''):v;}row[index]=value;}if(row.some(v=>v!==undefined&&String(v).trim()!==''))out.push(row.map(v=>v??''));}return out;}
async function unzip(buffer){
  const bytes=new Uint8Array(buffer),view=new DataView(buffer);let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break;}}
  if(end<0)throw new Error('Excel fileનો ZIP format વાંચી શકાયો નથી.');
  const count=view.getUint16(end+10,true),cdOffset=view.getUint32(end+16,true),files={};let ptr=cdOffset;
  for(let i=0;i<count;i++){
    if(view.getUint32(ptr,true)!==0x02014b50)throw new Error('Excel fileનો index ખોટો છે.');
    const method=view.getUint16(ptr+10,true),compressedSize=view.getUint32(ptr+20,true),nameLen=view.getUint16(ptr+28,true),extraLen=view.getUint16(ptr+30,true),commentLen=view.getUint16(ptr+32,true),localOffset=view.getUint32(ptr+42,true);
    const name=new TextDecoder().decode(bytes.slice(ptr+46,ptr+46+nameLen));ptr+=46+nameLen+extraLen+commentLen;
    const localNameLen=view.getUint16(localOffset+26,true),localExtraLen=view.getUint16(localOffset+28,true),start=localOffset+30+localNameLen+localExtraLen,packed=bytes.slice(start,start+compressedSize);let data;
    if(method===0)data=packed;
    else if(method===8){if(!('DecompressionStream'in window))throw new Error('આ browserમાં compressed Excel ખોલી શકાતી નથી. Excelમાંથી CSV export કરીને ફરી પ્રયત્ન કરો.');try{data=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());}catch{throw new Error('Excel file decompress થઈ શકી નથી. .xlsx તરીકે ફરી save કરો.');}}
    else continue;
    files[name]=new TextDecoder('utf-8').decode(data);
  }
  return files;
}
export async function readXlsx(buffer){
  const files=await unzip(buffer),workbookText=files['xl/workbook.xml'];if(!workbookText)throw new Error('આ fileમાં .xlsx workbook મળ્યો નથી.');
  const workbook=parseXml(workbookText),relsText=files['xl/_rels/workbook.xml.rels']||'',rels=relsText?parseXml(relsText):null,map={};
  if(rels)for(const r of Array.from(rels.getElementsByTagName('Relationship')))map[r.getAttribute('Id')]=r.getAttribute('Target');
  const shared=[];if(files['xl/sharedStrings.xml']){const doc=parseXml(files['xl/sharedStrings.xml']);for(const item of Array.from(doc.getElementsByTagName('si')))shared.push(Array.from(item.getElementsByTagName('t')).map(t=>t.textContent||'').join(''));}
  return Array.from(workbook.getElementsByTagName('sheet')).map(sheet=>{const name=sheet.getAttribute('name')||'Sheet';let id=sheet.getAttribute('r:id');if(!id)id=Array.from(sheet.attributes).find(a=>a.localName==='id')?.value;let target=(map[id]||'').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target;return{name,rows:files[target]?parseSheet(files[target],shared):[]};});
}
