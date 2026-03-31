/* cardRenderer.js — Canvas textures for every UNO card variant */
const CR = (() => {
  const CW=200,CH=290;
  const HEX={red:'#E53935',blue:'#1565C0',green:'#2E7D32',yellow:'#F9A825',
              pink:'#C2185B',teal:'#00695C',orange:'#E64A19',purple:'#6A1B9A',wild:'#0a0a0a'};
  const cache=new Map();
  const images={};

  // ── PUBLIC ──────────────────────────────────────────────────────────────
  async function preloadImages() {
    const list = [
      'flip_dark_bg_1774974382870.png', 'flip_light_bg_1774974400321.png', 
      'hp_darkmark_1774974353244.png', 'hp_dumbledore_1774974317681.png', 
      'hp_harry_1774974262293.png', 'hp_hermione_1774974281101.png', 
      'hp_ron_1774974300011.png', 'hp_voldemort_1774974335521.png', 
      'mercy_bg_1774974419773.png'
    ];
    for (const f of list) {
      const name = f.split('_177')[0]; 
      images[name] = await new Promise((r) => {
        const i = new Image(); 
        i.onload = ()=>r(i); 
        i.onerror = ()=>r(null); // prevent hanging on 404
        i.src = '/img/themes/' + f;
      });
    }
  }

  function getCanvas(card, isLight, variant, faceUp=true, w=68, h=96) {
    const side = variant==='flip' ? (isLight?card.light:card.dark) : card;
    const key = faceUp ? `f_${card.id}_${isLight?'L':'D'}_${w}` : `b_${variant}_${isLight?'L':'D'}_${w}`;
    if (cache.has(key)) return cache.get(key);
    const canvas=document.createElement('canvas');
    canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d');
    ctx.scale(w/CW, h/CH);
    faceUp ? drawFace(ctx,side,variant,isLight) : drawBack(ctx,variant,isLight);
    cache.set(key,canvas);
    return canvas;
  }

  function getTexture(card, isLight, variant, faceUp=true) {
    const canvas = getCanvas(card,isLight,variant,faceUp,CW,CH);
    return new THREE.CanvasTexture(canvas);
  }

  function getDataURL(card, isLight, variant, faceUp=true) {
    const canvas = getCanvas(card, isLight, variant, faceUp, CW, CH);
    return canvas.toDataURL('image/webp', 0.85);
  }

  // ── BACKS ───────────────────────────────────────────────────────────────
  function drawBack(ctx,variant,isLight) {
    clip(ctx,0,0,CW,CH,16);
    if (variant==='classic') {
      const g=ctx.createLinearGradient(0,0,0,CH);
      g.addColorStop(0,'#c62828'); g.addColorStop(1,'#8b0000');
      ctx.fillStyle=g; ctx.fillRect(0,0,CW,CH);
      ctx.save(); ctx.translate(CW/2,CH/2); ctx.rotate(-.28);
      const og=ctx.createLinearGradient(-60,0,60,0);
      og.addColorStop(0,'#1565C0'); og.addColorStop(1,'#0d47a1');
      ctx.fillStyle=og; ctx.beginPath(); ctx.ellipse(0,0,64,84,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
      text(ctx,'UNO',CW/2,CH/2,'bold 52px "Bebas Neue",sans-serif','#fff','center','middle');
      border(ctx,'rgba(255,255,255,.22)',4,12,12,CW-24,CH-24,10);
    } else if (variant==='hp') {
      const g=ctx.createLinearGradient(0,0,CW,CH);
      g.addColorStop(0,'#1a0533'); g.addColorStop(1,'#0a0116');
      ctx.fillStyle=g; ctx.fillRect(0,0,CW,CH);
      border(ctx,'#c9a84c',4,5,5,CW-10,CH-10,12);
      border(ctx,'rgba(201,168,76,.32)',1.5,11,11,CW-22,CH-22,8);
      ctx.fillStyle='rgba(201,168,76,.18)';ctx.font='11px serif';ctx.textAlign='left';
      for(let y=28;y<CH-16;y+=36) for(let x=16;x<CW-10;x+=36) ctx.fillText('✦',x+((y/36)%2)*18,y);
      text(ctx,'⚡',CW/2,CH/2-10,'52px serif','#c9a84c','center','middle',{blur:18,color:'#c9a84c'});
      text(ctx,'HARRY POTTER UNO',CW/2,CH/2+34,'bold 9px sans-serif','rgba(201,168,76,.65)','center','middle');
    } else if (variant==='flip' && !isLight) {
      if(images.flip_dark_bg) ctx.drawImage(images.flip_dark_bg,0,0,CW,CH);
      else { ctx.fillStyle='#070707'; ctx.fillRect(0,0,CW,CH); }
      border(ctx,'rgba(160,0,255,.5)',3,5,5,CW-10,CH-10,12);
      text(ctx,'⇅',CW/2,CH/2-12,'42px sans-serif','#ce93d8','center','middle');
      text(ctx,'DARK SIDE',CW/2,CH/2+28,'bold 11px monospace','rgba(160,0,255,.7)','center','middle');
    } else if (variant==='flip') {
      if(images.flip_light_bg) ctx.drawImage(images.flip_light_bg,0,0,CW,CH);
      else { ctx.fillStyle='#f5f5f5'; ctx.fillRect(0,0,CW,CH); }
      border(ctx,'#1a1a1a',3,5,5,CW-10,CH-10,12);
      text(ctx,'UNO FLIP',CW/2,CH/2+42,'bold 10px sans-serif','#1a1a1a','center','middle');
    } else { // mercy
      if(images.mercy_bg) ctx.drawImage(images.mercy_bg,0,0,CW,CH);
      else { ctx.fillStyle='#1a0000'; ctx.fillRect(0,0,CW,CH); }
      border(ctx,'#7a0000',4,5,5,CW-10,CH-10,12);
      border(ctx,'rgba(122,0,0,.3)',1.5,11,11,CW-22,CH-22,8);
      text(ctx,'💀',CW/2,CH/2-14,'52px serif','#cc0000','center','middle',{blur:18,color:'#ff0000'});
      text(ctx,'NO MERCY',CW/2,CH/2+30,'bold 9px monospace','#7a0000','center','middle');
    }
    ctx.restore();
  }

  // ── FACES ───────────────────────────────────────────────────────────────
  function drawFace(ctx,card,variant,isLight) {
    const {type,color,value}=card;
    const wild=['wild','wild4','voldemort','wildDraw2','wildDrawColor','wildRevDraw4','wildDraw6','wildDraw10','wildColorRoulette'];
    if (wild.includes(type)) { drawWild(ctx,card,variant,isLight); return; }
    const darkSide=variant==='flip'&&!isLight;
    const bg=HEX[color]||'#888';
    
    clip(ctx,0,0,CW,CH,16);
    
    // Draw background texture!
    if (variant === 'mercy' && images.mercy_bg) {
      ctx.drawImage(images.mercy_bg,0,0,CW,CH);
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle=bg; ctx.fillRect(0,0,CW,CH); ctx.restore();
    } else if (variant === 'flip' && darkSide && images.flip_dark_bg) {
      ctx.drawImage(images.flip_dark_bg,0,0,CW,CH);
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle=bg; ctx.fillRect(0,0,CW,CH); ctx.restore();
    } else if (variant === 'flip' && !darkSide && images.flip_light_bg) {
      ctx.drawImage(images.flip_light_bg,0,0,CW,CH);
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle=bg; ctx.fillRect(0,0,CW,CH); ctx.restore();
    } else {
      const g=ctx.createLinearGradient(0,0,CW,CH);
      g.addColorStop(0,lighten(bg,18)); g.addColorStop(1,darken(bg,10));
      ctx.fillStyle=g; ctx.fillRect(0,0,CW,CH);
    }
    
    border(ctx,darkSide?'rgba(0,0,0,.55)':'rgba(255,255,255,.5)',5,6,6,CW-12,CH-12,11);
    
    // Center portrait oval
    ctx.save(); ctx.translate(CW/2,CH/2); ctx.rotate(-.18);
    ctx.beginPath(); ctx.ellipse(0,0,CW*.32,CH*.41,0,0,Math.PI*2); 
    
    if (variant === 'hp') {
      ctx.save(); ctx.clip();
      ctx.rotate(.18); // unrotate for the image
      let img = null;
      if (color === 'red') img = images.hp_harry;
      if (color === 'blue') img = images.hp_hermione;
      if (color === 'green') img = images.hp_ron;
      if (color === 'yellow') img = images.hp_dumbledore;
      if (img) ctx.drawImage(img,-CW*.35,-CH*.45,CW*.7,CH*.9);
      // Removed the dark dimming overlay so the magical portraits pop brightly!
      ctx.restore();
    } else {
      ctx.fillStyle=darkSide?'rgba(0,0,0,.76)':'rgba(255,255,255,.9)'; ctx.fill();
    }
    ctx.restore();

    drawSymbol(ctx,card,bg,darkSide,variant);
    
    // Corners
    const lbl=cornerLabel(card);
    const cf=`bold ${CH*.135}px "Bebas Neue",Impact,sans-serif`;
    ctx.font=cf; ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.shadowColor='rgba(0,0,0,.45)'; ctx.shadowBlur=3;
    ctx.fillText(lbl,9,8);
    ctx.save(); ctx.translate(CW-9,CH-8); ctx.rotate(Math.PI); ctx.fillText(lbl,0,0); ctx.restore();
    ctx.shadowBlur=0;
    
    if (darkSide) { ctx.strokeStyle='#000'; ctx.lineWidth=7; rrPath(ctx,0,0,CW,CH,16); ctx.stroke(); }
    ctx.restore();
  }

  function drawSymbol(ctx,card,bg,darkSide, variant) {
    const {type,value}=card;
    const fc='#fff';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=fc; ctx.shadowColor='rgba(0,0,0,.7)'; ctx.shadowBlur=6;

    // Use alpha so Harry Potter art shines through the symbols
    if (variant === 'hp') ctx.globalAlpha = 0.75;
    
    if (type==='number') {
      ctx.font=`bold ${CH*.34}px "Bebas Neue",Impact,sans-serif`;
      ctx.fillText(String(value),CW/2,CH/2+2);
    } else if (type==='skip') {
      ctx.strokeStyle=fc; ctx.lineWidth=13;
      ctx.beginPath(); ctx.arc(CW/2,CH/2,42,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CW/2-31,CH/2+31); ctx.lineTo(CW/2+31,CH/2-31); ctx.stroke();
    } else if (type==='reverse') {
      ctx.font=`bold ${CH*.21}px sans-serif`; ctx.fillText('↺',CW/2,CH/2-18); ctx.fillText('↻',CW/2,CH/2+18);
    } else if (type==='draw2') {
      ctx.shadowBlur=2; twoCards(ctx,CW/2,CH/2,fc); ctx.shadowBlur=6; text(ctx,'+2',CW/2,CH/2+42,`bold ${CH*.13}px "Bebas Neue",sans-serif`,fc,'center','middle');
    } else if (type==='draw1') {
      ctx.shadowBlur=2; oneCard(ctx,CW/2,CH/2,fc); ctx.shadowBlur=6; text(ctx,'+1',CW/2,CH/2+40,`bold ${CH*.13}px "Bebas Neue",sans-serif`,fc,'center','middle');
    } else if (type==='draw4') {
      ctx.shadowBlur=2; fourCards(ctx,CW/2,CH/2,fc); ctx.shadowBlur=6; text(ctx,'+4',CW/2,CH/2+46,`bold ${CH*.12}px "Bebas Neue",sans-serif`,fc,'center','middle');
    } else if (type==='draw5') {
      ctx.shadowBlur=2; fiveCards(ctx,CW/2,CH/2,fc); ctx.shadowBlur=6; text(ctx,'+5',CW/2,CH/2+46,`bold ${CH*.12}px "Bebas Neue",sans-serif`,fc,'center','middle');
    } else if (type==='flip') {
      ctx.font=`bold ${CH*.24}px sans-serif`; ctx.fillText('⇅',CW/2,CH/2-6);
      text(ctx,'FLIP',CW/2,CH/2+28,`bold ${CH*.09}px "Bebas Neue",sans-serif`,fc,'center','middle');
    } else if (type==='skipAll' || type === 'skipEveryone') {
      ctx.font=`bold ${CH*.14}px sans-serif`; ctx.fillText('⊘',CW/2-18,CH/2-8); ctx.fillText('⊘',CW/2+18,CH/2-8); ctx.fillText('⊘',CW/2,CH/2+14);
    } else if (type==='discardAll') {
      ctx.font=`bold ${CH*.17}px sans-serif`; ctx.fillText('✕',CW/2,CH/2-8);
      text(ctx,'ALL',CW/2,CH/2+24,`bold ${CH*.1}px "Bebas Neue",sans-serif`,fc,'center','middle');
    }
    ctx.shadowBlur=0;
    ctx.globalAlpha = 1.0; // Reset alpha
  }

  function drawWild(ctx,card,variant,isLight) {
    const {type}=card;
    if (type==='voldemort') { drawVoldemort(ctx); return; }
    const dark=variant==='flip'&&!isLight;
    const qc=dark?['#C2185B','#00695C','#E64A19','#6A1B9A']:['#E53935','#1565C0','#2E7D32','#F9A825'];

    clip(ctx,0,0,CW,CH,16);
    
    if (variant === 'hp' && images.hp_darkmark) {
      ctx.drawImage(images.hp_darkmark,0,0,CW,CH);
    } else {
      ctx.fillStyle=qc[0]; ctx.fillRect(0,0,CW/2,CH/2);
      ctx.fillStyle=qc[1]; ctx.fillRect(CW/2,0,CW/2,CH/2);
      ctx.fillStyle=qc[2]; ctx.fillRect(0,CH/2,CW/2,CH/2);
      ctx.fillStyle=qc[3]; ctx.fillRect(CW/2,CH/2,CW/2,CH/2);
      ctx.fillStyle='#080808'; ctx.beginPath(); ctx.ellipse(CW/2,CH/2,CW*.33,CH*.4,0,0,Math.PI*2); ctx.fill();
    }
    
    const lm={
      wild:'WILD', wild4:'WILD\n+4', wildDraw2:'WILD\n+2', wildDrawColor:'WILD\n+C', wildRevDraw4:'WILD\n↺+4',
      wildDraw6:'WILD\n+6', wildDraw10:'WILD\n+10', wildColorRoulette:'WILD\n🎰'
    };
    const parts=(lm[type]||type.toUpperCase()).split('\n');
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,1)'; ctx.shadowBlur=8;
    
    if (parts.length===2) {
      ctx.font=`bold ${CH*.13}px "Bebas Neue",sans-serif`; ctx.fillText(parts[0],CW/2,CH/2-14);
      ctx.font=`bold ${CH*.19}px "Bebas Neue",sans-serif`; ctx.fillText(parts[1],CW/2,CH/2+12);
    } else {
      ctx.font=`bold ${CH*.2}px "Bebas Neue",sans-serif`; ctx.fillText(parts[0],CW/2,CH/2);
    }
    ctx.shadowBlur=0;

    const cl=cornerLabel(card);
    ctx.font=`bold ${CH*.09}px "Bebas Neue",sans-serif`; ctx.fillStyle='#fff';
    ctx.shadowColor='black'; ctx.shadowBlur=4;
    ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(cl,9,8);
    ctx.save(); ctx.translate(CW-9,CH-8); ctx.rotate(Math.PI); ctx.fillText(cl,0,0); ctx.restore();
    ctx.restore();
  }

  function drawVoldemort(ctx) {
    clip(ctx,0,0,CW,CH,16);
    if(images.hp_voldemort) {
      ctx.drawImage(images.hp_voldemort,0,0,CW,CH);
    } else {
      ctx.fillStyle='#080812'; ctx.fillRect(0,0,CW,CH);
    }
    border(ctx,'#4a148c',4,5,5,CW-10,CH-10,12);
    text(ctx,'VOLDEMORT',CW/2,CH/2+60,'bold 24px "Bebas Neue",sans-serif','#fff','center','middle',{blur:6,color:'#000'});
    text(ctx,'🐍',10,10,'bold '+CH*.08+'px "Bebas Neue",sans-serif','#9c27b0','left','top');
    ctx.restore();
  }

  // ── CARD ICON HELPERS ────────────────────────────────────────────────────
  function oneCard(ctx,cx,cy,col){
    ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=3; ctx.fillStyle='rgba(255,255,255,.18)';
    rrPath(ctx,cx-17,cy-26,34,48,4); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function twoCards(ctx,cx,cy,col){
    ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=3;
    ctx.fillStyle='rgba(255,255,255,.13)'; rrPath(ctx,cx-21,cy-22,33,47,4); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.24)'; rrPath(ctx,cx-7,cy-32,33,47,4); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function fourCards(ctx,cx,cy,col){
    ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=2;
    [[-20,-6],[-7,-16],[6,-6],[19,-16]].forEach(([ox,oy],i)=>{
      ctx.fillStyle=`rgba(255,255,255,${.1+i*.05})`; rrPath(ctx,cx+ox,cy+oy,24,36,3); ctx.fill(); ctx.stroke();
    }); ctx.restore();
  }
  function fiveCards(ctx,cx,cy,col){
    ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=2;
    [[-27,-3],[-13,-13],[1,-3],[15,-13],[29,-3]].forEach(([ox,oy],i)=>{
      ctx.fillStyle=`rgba(255,255,255,${.08+i*.04})`; rrPath(ctx,cx+ox-11,cy+oy-15,22,32,3); ctx.fill(); ctx.stroke();
    }); ctx.restore();
  }

  function cornerLabel(card) {
    const {type,value}=card;
    if (type==='number') return String(value);
    const m={skip:'⊘',reverse:'↺',draw2:'+2',draw1:'+1',draw4:'+4',draw5:'+5',flip:'⇅',
      skipAll:'⊘A',skipEveryone:'⊘A',discardAll:'✕A',wild:'W',wild4:'W+4',wildDraw2:'W+2',wildDrawColor:'W+C',
      wildRevDraw4:'W↺4',wildDraw6:'W+6',wildDraw10:'W+10',wildColorRoulette:'W🎰',voldemort:'🐍'};
    return m[type]||type.slice(0,4).toUpperCase();
  }

  function rrPath(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }
  function clip(ctx,x,y,w,h,r){ rrPath(ctx,x,y,w,h,r); ctx.save(); ctx.clip(); }
  function border(ctx,col,lw,x,y,w,h,r){
    ctx.strokeStyle=col; ctx.lineWidth=lw; rrPath(ctx,x,y,w,h,r); ctx.stroke();
  }
  function text(ctx,str,x,y,font,col,align='center',base='middle',shadow=null){
    if(shadow){ctx.shadowColor=shadow.color;ctx.shadowBlur=shadow.blur;}
    ctx.font=font; ctx.fillStyle=col; ctx.textAlign=align; ctx.textBaseline=base;
    ctx.fillText(str,x,y);
    if(shadow){ctx.shadowBlur=0;}
  }
  function lighten(hex,a){
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return `rgb(${Math.min(255,r+a)},${Math.min(255,g+a)},${Math.min(255,b+a)})`;
  }
  function darken(hex,a){
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return `rgb(${Math.max(0,r-a)},${Math.max(0,g-a)},${Math.max(0,b-a)})`;
  }

  function clearCache() {
    cache.clear();
  }

  return {preloadImages,getCanvas,getTexture,getDataURL,HEX,CW,CH,clearCache};
})();
