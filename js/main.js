import { GAME } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { PlacementScene } from './scenes/PlacementScene.js';
import { BattleScene } from './scenes/BattleScene.js';

new Phaser.Game({
  type:Phaser.AUTO,
  width:GAME.width,
  height:GAME.height,
  parent:'game-container',
  backgroundColor:'#090711',
  antialias:true,
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  scene:[BootScene,MenuScene,PlacementScene,BattleScene]
});
