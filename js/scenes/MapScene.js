import { GAME } from '../config.js';
import { SAVE, generateMap, saveRun, startNode } from '../data/save.js';
import { calculateDifficulty } from '../systems/difficulty.js';
import { makeButton, flashText } from '../utils/helpers.js';

const LABELS={combat:'Combate',recruit:'Reclutamiento',relic:'Reliquia',merchant:'Mercader',event:'Evento',boss:'Boss'};
const TEXTURES={combat:'mapCombat',recruit:'mapRecruit',relic:'mapRelic',merchant:'mapMerchant',event:'mapEvent',boss:'mapBoss'};
const SELECTED={combat:'mapCombatSelected',recruit:'mapRecruitSelected',relic:'mapRelicSelected',merchant:'mapMerchantSelected',event:'mapEventSelected',boss:'mapBossSelected'};

const WORLD_HEIGHT=1240;
const MAP_TOP=125;
const ROW_GAP=70;
const COL_X=[190,415,640,865,1090];
const CAMERA_STEP=85;

export class MapScene extends Phaser.Scene{
  constructor(){super('Map');}

  create(){
    if(!SAVE.generatedMap)SAVE.generatedMap=generateMap(SAVE.mapNumber,SAVE.seed);
    this.selectedNodeId=null;
    this.nodeIcons=new Map();

    this.cameras.main.setBounds(0,0,GAME.width,WORLD_HEIGHT);
    this.physics?.world?.setBounds?.(0,0,GAME.width,WORLD_HEIGHT);

    // El fondo permanece fijo mientras el mapa se desplaza por encima.
    this.add.image(GAME.width/2,GAME.height/2,'mapBg')
      .setDisplaySize(GAME.width,GAME.height)
      .setScrollFactor(0)
      .setDepth(-20);
    this.add.rectangle(GAME.width/2,GAME.height/2,GAME.width,GAME.height,0x05040a,.28)
      .setScrollFactor(0)
      .setDepth(-19);

    this.drawMap();
    this.createHud();
    this.configureScrolling();
    this.centerCameraOnProgress();
  }

  createHud(){
    const hudDepth=100;
    this.add.text(34,20,`MAPA ${SAVE.mapNumber}`,{
      fontSize:'30px',fontStyle:'bold',color:'#fff',stroke:'#17101f',strokeThickness:5
    }).setScrollFactor(0).setDepth(hudDepth);

    this.add.text(1245,24,`VIDAS ${'♥'.repeat(SAVE.lives)}${'♡'.repeat(3-SAVE.lives)}  ·  ORO ${SAVE.gold}`,{
      fontSize:'20px',fontStyle:'bold',color:'#ffe596',stroke:'#17101f',strokeThickness:4
    }).setOrigin(1,0).setScrollFactor(0).setDepth(hudDepth);

    this.hint=this.add.text(640,21,'PULSA DOS VECES EL MISMO NODO PARA ENTRAR',{
      fontSize:'18px',fontStyle:'bold',color:'#f4e5ff',stroke:'#17101f',strokeThickness:4
    }).setOrigin(.5,0).setScrollFactor(0).setDepth(hudDepth);

    this.info=this.add.text(640,54,'Usa la rueda del ratón para recorrer el mapa.',{
      fontSize:'15px',fontStyle:'bold',color:'#eee5f2',align:'center',
      stroke:'#17101f',strokeThickness:3
    }).setOrigin(.5,0).setScrollFactor(0).setDepth(hudDepth);

    const menuButton=makeButton(this,1135,670,230,42,'GUARDAR Y MENÚ',()=>{
      saveRun();this.scene.start('Menu');
    });
    this.setFixedDepth(menuButton,hudDepth);
  }

  setFixedDepth(target,depth){
    if(!target)return;
    if(typeof target.setScrollFactor==='function')target.setScrollFactor(0);
    if(typeof target.setDepth==='function')target.setDepth(depth);
    if(target.bg)this.setFixedDepth(target.bg,depth);
    if(target.text)this.setFixedDepth(target.text,depth);
    if(Array.isArray(target.list))target.list.forEach(child=>this.setFixedDepth(child,depth));
  }

  configureScrolling(){
    this.input.on('wheel',(_pointer,_objects,_dx,dy)=>{
      const camera=this.cameras.main;
      camera.scrollY=Phaser.Math.Clamp(camera.scrollY+Math.sign(dy)*CAMERA_STEP,0,WORLD_HEIGHT-GAME.height);
    });

    this.input.keyboard?.on('keydown-UP',()=>this.scrollCamera(-CAMERA_STEP));
    this.input.keyboard?.on('keydown-DOWN',()=>this.scrollCamera(CAMERA_STEP));
    this.input.keyboard?.on('keydown-W',()=>this.scrollCamera(-CAMERA_STEP));
    this.input.keyboard?.on('keydown-S',()=>this.scrollCamera(CAMERA_STEP));
  }

  scrollCamera(amount){
    const camera=this.cameras.main;
    camera.scrollY=Phaser.Math.Clamp(camera.scrollY+amount,0,WORLD_HEIGHT-GAME.height);
  }

  centerCameraOnProgress(){
    const map=SAVE.generatedMap;
    const focusId=SAVE.currentNodeId||map.startNodeId;
    const focusNode=map.nodes.find(node=>node.id===focusId)||map.nodes[0];
    const y=this.position(focusNode).y;
    this.cameras.main.scrollY=Phaser.Math.Clamp(y-GAME.height*.58,0,WORLD_HEIGHT-GAME.height);
  }

  reachableIds(){
    const map=SAVE.generatedMap;
    if(!SAVE.currentNodeId)return [map.startNodeId];
    return map.nodes.find(n=>n.id===SAVE.currentNodeId)?.links||[];
  }

  position(node){
    return {x:COL_X[node.col]??640,y:WORLD_HEIGHT-MAP_TOP-node.row*ROW_GAP};
  }

  drawDottedPath(a,b,active,available){
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    const spacing=active?20:23;
    const steps=Math.max(2,Math.floor(d/spacing));
    for(let i=1;i<steps;i++){
      const t=i/steps;
      this.add.image(a.x+dx*t,a.y+dy*t,active?'mapPathActive':'mapPath')
        .setDisplaySize(active?9:7,active?9:7)
        .setAlpha(active?.92:available?.58:.28)
        .setDepth(-2);
    }
  }

  drawMap(){
    const nodes=SAVE.generatedMap.nodes;
    const reachable=this.reachableIds();
    const visited=new Set(SAVE.visitedNodes);

    nodes.forEach(node=>node.links.forEach(id=>{
      const target=nodes.find(candidate=>candidate.id===id);
      if(!target)return;
      const active=visited.has(node.id)&&visited.has(target.id);
      const available=(SAVE.currentNodeId===node.id&&reachable.includes(target.id))||(!SAVE.currentNodeId&&target.id===SAVE.generatedMap.startNodeId);
      this.drawDottedPath(this.position(node),this.position(target),active,available);
    }));

    nodes.forEach(node=>{
      const {x,y}=this.position(node);
      const isVisited=visited.has(node.id);
      const isCurrent=SAVE.currentNodeId===node.id;
      const can=reachable.includes(node.id);
      const state=isCurrent?'mapStateCurrent':isVisited?'mapStateCompleted':can?'mapStateAvailable':'mapStateLocked';

      const stateImage=this.add.image(x,y,state)
        .setDisplaySize(68,68)
        .setAlpha(isVisited&&!isCurrent?.78:1)
        .setDepth(1);
      const icon=this.add.image(x,y,TEXTURES[node.type])
        .setDisplaySize(node.type==='boss'?52:46,node.type==='boss'?52:46)
        .setAlpha(!can&&!isVisited?.42:1)
        .setDepth(2);
      this.nodeIcons.set(node.id,icon);

      this.add.text(x-38,y-38,`${node.row+1}`,{
        fontSize:'12px',fontStyle:'bold',color:'#f2e8f7',stroke:'#17101f',strokeThickness:3
      }).setOrigin(.5).setDepth(3);

      if(can){
        stateImage.setInteractive({useHandCursor:true});
        icon.setInteractive({useHandCursor:true});
        const handler=()=>this.selectNode(node);
        stateImage.on('pointerdown',handler);
        icon.on('pointerdown',handler);
        icon.on('pointerover',()=>icon.setTexture(SELECTED[node.type]));
        icon.on('pointerout',()=>{
          if(this.selectedNodeId!==node.id)icon.setTexture(TEXTURES[node.type]);
        });
      }
    });
  }

  selectNode(node){
    const difficulty=calculateDifficulty(SAVE,node);
    const confirming=this.selectedNodeId===node.id;

    this.info.setText(`${LABELS[node.type].toUpperCase()} · Nivel ${node.row+1}/15 · Dificultad ${difficulty.score} · ${confirming?'Pulsa otra vez para confirmar':'Nodo seleccionado'}`);

    if(!confirming){
      if(this.selectedNodeId){
        const previous=SAVE.generatedMap.nodes.find(candidate=>candidate.id===this.selectedNodeId);
        const previousIcon=this.nodeIcons.get(this.selectedNodeId);
        if(previous&&previousIcon)previousIcon.setTexture(TEXTURES[previous.type]);
      }
      this.selectedNodeId=node.id;
      this.nodeIcons.get(node.id)?.setTexture(SELECTED[node.type]);
      flashText(this,`Seleccionado: ${LABELS[node.type]}. Pulsa otra vez para entrar.`,640,this.cameras.main.scrollY+GAME.height-62,0xffe596);
      return;
    }

    startNode({...node,difficulty});
    if(node.type==='combat'||node.type==='boss'){
      this.scene.start('Placement',{nodeType:node.type,difficulty});return;
    }
    this.scene.start('NodeEvent',{nodeType:node.type,nodeId:node.id,difficulty});
  }
}
