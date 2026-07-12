export function makeButton(scene,x,y,w,h,label,onClick){
  const bg=scene.add.rectangle(x,y,w,h,0x5b317f,.96).setStrokeStyle(3,0xd7a9ff).setInteractive({useHandCursor:true});
  const text=scene.add.text(x,y,label,{fontFamily:'Arial',fontSize:'20px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
  bg.on('pointerover',()=>bg.setFillStyle(0x75459a,1)).on('pointerout',()=>bg.setFillStyle(0x5b317f,.96)).on('pointerdown',onClick);
  return {bg,text,setDepth(depth){bg.setDepth(depth);text.setDepth(depth);return this;}};
}

export function flashText(scene,text,x,y,color=0xffffff){
  const t=scene.add.text(x,y,text,{fontSize:'19px',fontStyle:'bold',color:Phaser.Display.Color.IntegerToColor(color).rgba,backgroundColor:'#130d1b',padding:{x:12,y:7}}).setOrigin(.5).setDepth(100);
  scene.tweens.add({targets:t,y:y-25,alpha:0,duration:1100,onComplete:()=>t.destroy()});
}

export function floatNumber(scene,text,x,y,color){
  const t=scene.add.text(x,y,text,{fontSize:'25px',fontStyle:'bold',color:Phaser.Display.Color.IntegerToColor(color).rgba,stroke:'#160a0d',strokeThickness:4}).setOrigin(.5).setDepth(30);
  scene.tweens.add({targets:t,y:y-40,alpha:0,duration:700,onComplete:()=>t.destroy()});
}
