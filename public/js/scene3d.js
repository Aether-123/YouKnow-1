/* scene3d.js — Three.js table, lighting, card meshes, animations */
const S3D = (() => {
  let scene,camera,renderer,clock,raycaster,mouse;
  let meshes={}, tweens=[], hovered=null;
  let discardTrail=[];
  let clickCb=null, container;
  const CW=1.5,CH=0.022,CD=2.12;

  // Seat positions [x,z,rotY] indexed 0=local(bottom)
  const SEATS=[
    [0,11,0],[0,-11,Math.PI],
    [-9.5,0,Math.PI/2],[9.5,0,-Math.PI/2],
    [-7,-8,2.3],[7,-8,-2.3],
    [-7,8,.8],[7,8,-.8],
    [-10,3,1.6],[10,3,-1.6]
  ];
  const DECK={x:2.5,y:.06,z:0}, DISC={x:-2.5,y:.06,z:0};

  function init(el,clickCallback){
    container=el; clickCb=clickCallback;
    clock=new THREE.Clock(); raycaster=new THREE.Raycaster(); mouse=new THREE.Vector2(-9e9,-9e9);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(el.clientWidth,el.clientHeight);
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x060a10);
    el.appendChild(renderer.domElement);

    scene=new THREE.Scene();
    scene.fog=new THREE.Fog(0x060a10,32,70);

    const aspect=el.clientWidth/el.clientHeight;
    camera=new THREE.PerspectiveCamera(48,aspect,.1,100);
    camera.position.set(0,24,17); camera.lookAt(0,0,2);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff,.55));
    const sun=new THREE.DirectionalLight(0xfff8e7,1.0);
    sun.position.set(-8,22,10); sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    ['left','right','top','bottom'].forEach((k,i)=>sun.shadow.camera[k]=i<2?[-22,22][i]:i<4?[22,-22][i-2]:0);
    sun.shadow.camera.far=50; scene.add(sun);
    const fill=new THREE.PointLight(0x5577ff,.3,40); fill.position.set(8,12,-6); scene.add(fill);
    const pt=new THREE.PointLight(0xffffff,.28,20); pt.position.set(0,8,0); scene.add(pt);

    buildTable();

    // Deck placeholder
    const dg=new THREE.BoxGeometry(CW,CH*20,CD);
    const dm=new THREE.MeshStandardMaterial({
      color:0xf3e6d2,
      roughness:.42,
      metalness:.03,
      emissive:0x1a140c,
      emissiveIntensity:.22
    });
    const dMesh=new THREE.Mesh(dg,dm);
    dMesh.position.set(DECK.x,.11,DECK.z);
    dMesh.userData={card:{id:'__deck__'}};
    scene.add(dMesh);

    // Top card face for visual clarity.
    const topGeo=new THREE.BoxGeometry(CW*.98,CH*1.6,CD*.98);
    const topMat=new THREE.MeshLambertMaterial({color:0xb71c1c});
    const topMesh=new THREE.Mesh(topGeo,topMat);
    topMesh.position.set(DECK.x,.245,DECK.z);
    topMesh.rotation.y=.08;
    topMesh.userData={card:{id:'__deck__'}};
    scene.add(topMesh);

    // Soft halo to make draw pile obvious on wood table.
    const haloGeo=new THREE.RingGeometry(.88,1.12,32);
    const haloMat=new THREE.MeshBasicMaterial({color:0xffcc80,transparent:true,opacity:.28,side:THREE.DoubleSide});
    const halo=new THREE.Mesh(haloGeo,haloMat);
    halo.position.set(DECK.x,.015,DECK.z);
    halo.rotation.x=-Math.PI/2;
    scene.add(halo);

    meshes['__deck__']=dMesh;

    // Discard zone
    const dzg=new THREE.PlaneGeometry(CW+.4,CD+.4);
    const dzm=new THREE.MeshLambertMaterial({color:0x261616,transparent:true,opacity:.48,side:THREE.DoubleSide});
    const dz=new THREE.Mesh(dzg,dzm); dz.rotation.x=-Math.PI/2; dz.position.set(DISC.x,.003,DISC.z); scene.add(dz);

    window.addEventListener('resize',onResize);
    renderer.domElement.addEventListener('click',onClick);
    renderer.domElement.addEventListener('mousemove',onMouseMove);
    animate();
  }

  function destroy(){
    window.removeEventListener('resize',onResize);
    if(renderer){renderer.dispose();renderer.domElement.remove();}
    scene=camera=renderer=null; meshes={}; tweens=[];
  }

  // ── TABLE ──────────────────────────────────────────────────────────────
  function buildTable(){
    // Outer rim
    const rim=new THREE.Mesh(
      new THREE.CylinderGeometry(16.5,17.5,.9,64),
      new THREE.MeshLambertMaterial({color:0x4a2a12})
    ); rim.position.y=-.45; rim.receiveShadow=true; scene.add(rim);

    // Wooden top
    const fc=document.createElement('canvas'); fc.width=fc.height=1024;
    const c=fc.getContext('2d');
    const g=c.createRadialGradient(512,512,40,512,512,620);
    g.addColorStop(0,'#8f623b');
    g.addColorStop(.65,'#6f4829');
    g.addColorStop(1,'#4a2f1a');
    c.fillStyle=g;
    c.fillRect(0,0,1024,1024);

    // Rings + grain to mimic a varnished wooden table.
    c.globalAlpha=.22;
    c.strokeStyle='#2b170b';
    for(let r=70;r<510;r+=28){
      c.lineWidth=1.2+Math.random()*1.5;
      c.beginPath();
      c.arc(512,512,r,0,Math.PI*2);
      c.stroke();
    }
    c.globalAlpha=.16;
    c.strokeStyle='#b48258';
    for(let i=0;i<240;i++){
      const y=Math.random()*1024;
      const len=280+Math.random()*500;
      const x=(1024-len)*Math.random();
      c.lineWidth=.5+Math.random()*1.2;
      c.beginPath();
      c.moveTo(x,y);
      c.bezierCurveTo(x+len*.25,y+Math.random()*9-4,x+len*.75,y+Math.random()*9-4,x+len,y+Math.random()*9-4);
      c.stroke();
    }
    c.globalAlpha=1;

    // Soft specular vignette
    const vg=c.createRadialGradient(512,512,140,512,512,530);
    vg.addColorStop(0,'rgba(255,235,210,.16)');
    vg.addColorStop(1,'rgba(0,0,0,.22)');
    c.fillStyle=vg;
    c.fillRect(0,0,1024,1024);

    const woodTex=new THREE.CanvasTexture(fc);
    woodTex.anisotropy=4;
    const wood=new THREE.Mesh(
      new THREE.CircleGeometry(15.5,64),
      new THREE.MeshStandardMaterial({map:woodTex,roughness:.74,metalness:.06,color:0xffffff})
    );
    wood.rotation.x=-Math.PI/2;
    wood.receiveShadow=true;
    scene.add(wood);
  }

  // ── CARD MESH ──────────────────────────────────────────────────────────
  function makeMesh(card,isLight,variant,faceUp){
    const geo=new THREE.BoxGeometry(CW,CH,CD);
    const ft=CR.getTexture(card,isLight,variant,true);
    const bt=CR.getTexture(card,isLight,variant,false);
    const edge=new THREE.MeshLambertMaterial({color:0xefefef});
    const mats=[edge,edge,
      new THREE.MeshLambertMaterial({map:faceUp?ft:bt}),
      new THREE.MeshLambertMaterial({map:faceUp?bt:ft}),
      edge,edge];
    const m=new THREE.Mesh(geo,mats);
    m.castShadow=true; m.receiveShadow=true;
    m.userData={card,isLight,variant,faceUp};
    return m;
  }

  function updateFace(mesh,card,isLight,variant,faceUp){
    const ft=CR.getTexture(card,isLight,variant,true);
    const bt=CR.getTexture(card,isLight,variant,false);
    mesh.material[2].map=faceUp?ft:bt; mesh.material[2].needsUpdate=true;
    mesh.material[3].map=faceUp?bt:ft; mesh.material[3].needsUpdate=true;
    mesh.userData={card,isLight,variant,faceUp};
  }

  // ── POSITIONS ──────────────────────────────────────────────────────────
  function handPositions(count,seat){
    const [bx,bz,ry]=SEATS[Math.min(seat,SEATS.length-1)];
    const spread=Math.min(count*1.05,14);
    return Array.from({length:count},(_,i)=>{
      const t=count>1?i/(count-1):.5;
      const off=(t-.5)*spread;
      const horiz=Math.abs(Math.sin(ry))<.5;
      return {x:bx+(horiz?off:0),y:.06+i*.0038,z:bz+(horiz?0:off),ry};
    });
  }

  // ── PUBLIC API ──────────────────────────────────────────────────────────
  function clearAll(){Object.keys(meshes).forEach(k=>{scene.remove(meshes[k]);});discardTrail.forEach(m=>scene.remove(m));meshes={};discardTrail=[];tweens=[];}

  function setDiscard(card,isLight,variant){
    const old=meshes['__disc__'];
    if(old){
      old.userData.card=null;
      discardTrail.push(old);
      if(discardTrail.length>7){
        const rm=discardTrail.shift();
        if(rm) scene.remove(rm);
      }
      discardTrail.forEach((m,i)=>{
        m.position.set(
          DISC.x + (Math.sin(i*1.3)*0.05),
          DISC.y + (i*0.003),
          DISC.z + (Math.cos(i*1.1)*0.05)
        );
        m.rotation.y += 0.04;
      });
    }
    if(!card){delete meshes['__disc__'];return;}
    const m=makeMesh(card,isLight,variant,true);
    m.position.set(DISC.x,DISC.y+.03,DISC.z); m.rotation.y=(Math.random()-.5)*.4;
    scene.add(m); meshes['__disc__']=m;
  }

  function placeHidden(count,seat){
    const key=`__opp_${seat}__`;
    // Remove old
    Object.keys(meshes).filter(k=>k.startsWith(key)).forEach(k=>{scene.remove(meshes[k]);delete meshes[k];});
    const positions=handPositions(count,seat);
    const dummy={id:`opp_${seat}`,type:'number',color:'red',value:0,variant:'classic'};
    positions.forEach((pos,i)=>{
      const m=makeMesh(dummy,'classic',false,false);
      m.position.set(DECK.x,DECK.y+.3,DECK.z); m.rotation.y=pos.ry;
      scene.add(m); meshes[key+i]=m;
      setTimeout(()=>tween(m,{x:pos.x,y:pos.y,z:pos.z},i===0?.35:.25),i*35);
    });
  }

  function dealCard(card,seat,isLight,variant,handIdx,handLen,faceUp,delay=0,onDone){
    const pos=handPositions(handLen,seat)[handIdx]||{x:0,y:.06,z:11,ry:0};
    setTimeout(()=>{
      const m=makeMesh(card,isLight,variant,faceUp);
      m.position.set(DECK.x,DECK.y+.4,DECK.z); m.rotation.y=pos.ry;
      scene.add(m); meshes[card.id]=m;
      tween(m,{x:pos.x,y:pos.y,z:pos.z,arcH:2.4},.38,null,onDone);
    },delay);
  }

  function animPlay(cardId,card,isLight,variant,onDone){
    const m=meshes[cardId];
    if(!m){setDiscard(card,isLight,variant);onDone?.();return;}
    updateFace(m,card,isLight,variant,true);
    tween(m,{x:DISC.x,y:DISC.y,z:DISC.z,ry:(Math.random()-.5)*.4,arcH:3.6},.48,null,()=>{
      const old=meshes['__disc__']; if(old&&old!==m) scene.remove(old);
      meshes['__disc__']=m; delete meshes[cardId]; onDone?.();
    });
  }

  function animDraw(card,seat,isLight,variant,handIdx,handLen,faceUp,onDone){
    if(meshes[card.id]){scene.remove(meshes[card.id]);}
    dealCard(card,seat,isLight,variant,handIdx,handLen,faceUp,0,onDone);
  }

  function rebuildSeat(cards,seat,isLight,variant,faceUp){
    // Remove old
    cards.forEach(c=>{if(meshes[c.id]){scene.remove(meshes[c.id]);delete meshes[c.id];}});
    const positions=handPositions(cards.length,seat);
    cards.forEach((card,i)=>{
      const m=makeMesh(card,isLight,variant,faceUp);
      const pos=positions[i]||{x:0,y:.06,z:11,ry:0};
      m.position.set(pos.x,pos.y,pos.z); m.rotation.y=pos.ry;
      scene.add(m); meshes[card.id]=m;
    });
  }

  function animFlip(cards,newIsLight,variant,onDone){
    let done=0,total=cards.length;
    if(!total){onDone?.();return;}
    cards.forEach((card,i)=>{
      const m=meshes[card.id]; if(!m){done++;if(done>=total)onDone?.();return;}
      setTimeout(()=>{
        tween(m,{ry:m.rotation.y+Math.PI},.45,null,()=>{
          updateFace(m,card,newIsLight,variant,m.userData.faceUp??false);
          done++; if(done>=total) onDone?.();
        });
      },i*14);
    });
  }

  function shake(cardId){
    const m=meshes[cardId]; if(!m) return;
    const ox=m.position.x; let t=0;
    const iv=setInterval(()=>{t+=.05;m.position.x=ox+Math.sin(t*36)*.13*Math.max(0,1-t/.45);if(t>.45){clearInterval(iv);m.position.x=ox;}},16);
  }

  function removeCard(id){const m=meshes[id];if(m){scene.remove(m);delete meshes[id];}}

  // ── TWEENS ─────────────────────────────────────────────────────────────
  function tween(mesh,to,dur=.4,ease,onDone){
    const from={x:mesh.position.x,y:mesh.position.y,z:mesh.position.z,ry:mesh.rotation.y};
    tweens.push({mesh,from,to,dur,elapsed:0,ease:ease||eio,onDone,done:false});
  }
  function eio(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
  function lerp(a,b,t){return a+(b-a)*t;}
  function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

  // ── RENDER LOOP ─────────────────────────────────────────────────────────
  function animate(){
    requestAnimationFrame(animate);
    if(!renderer) return;
    const dt=Math.min(clock.getDelta(),.05);
    tweens=tweens.filter(tw=>{
      tw.elapsed=Math.min(tw.elapsed+dt,tw.dur);
      const t=tw.ease(tw.elapsed/tw.dur);
      const m=tw.mesh; if(!m.parent){tw.done=true;return false;}
      if(tw.to.x!==undefined) m.position.x=lerp(tw.from.x,tw.to.x,t);
      if(tw.to.y!==undefined) m.position.y=lerp(tw.from.y,tw.to.y,t);
      if(tw.to.z!==undefined) m.position.z=lerp(tw.from.z,tw.to.z,t);
      if(tw.to.ry!==undefined) m.rotation.y=lerp(tw.from.ry,tw.to.ry,t);
      if(tw.to.arcH) m.position.y+=Math.sin(t*Math.PI)*tw.to.arcH;
      if(tw.elapsed>=tw.dur&&!tw.done){tw.done=true;tw.onDone?.();}
      return !tw.done;
    });
    renderer.render(scene,camera);
  }

  function onResize(){
    if(!renderer||!container) return;
    camera.aspect=container.clientWidth/container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth,container.clientHeight);
  }
  function onClick(e){
    if(!clickCb) return;
    const r=renderer.domElement.getBoundingClientRect();
    mouse.x=((e.clientX-r.left)/r.width)*2-1;
    mouse.y=-((e.clientY-r.top)/r.height)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects(Object.values(meshes).filter(m=>m.parent===scene),false);
    if(hits.length) clickCb(hits[0].object.userData.card?.id);
  }
  function onMouseMove(e){
    const r=renderer.domElement.getBoundingClientRect();
    mouse.x=((e.clientX-r.left)/r.width)*2-1;
    mouse.y=-((e.clientY-r.top)/r.height)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects(Object.values(meshes).filter(m=>m.parent===scene),false);
    if(hits.length){
      const m=hits[0].object;
      if(hovered!==m){if(hovered&&hovered.parent)tween(hovered,{y:hovered.userData.baseY??hovered.position.y},.15);hovered=m;m.userData.baseY=m.position.y;tween(m,{y:m.position.y+.28},.15);}
      renderer.domElement.style.cursor='pointer';
    } else {
      if(hovered&&hovered.parent) tween(hovered,{y:hovered.userData.baseY??hovered.position.y},.15);
      hovered=null; renderer.domElement.style.cursor='default';
    }
  }

  return {init,destroy,clearAll,setDiscard,placeHidden,dealCard,animPlay,animDraw,rebuildSeat,animFlip,shake,removeCard,
    handPositions,SEATS,DECK,DISC,getMeshes:()=>meshes};
})();
