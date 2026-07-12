import { GAME } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { PlacementScene } from './scenes/PlacementScene.js';
import { EncyclopediaScene } from './scenes/EncyclopediaScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { RewardScene } from './scenes/RewardScene.js';
import { RelicsScene } from './scenes/RelicsScene.js';
import { SkillChoiceScene } from './scenes/SkillChoiceScene.js';
import { MapScene } from './scenes/MapScene.js';
import { ShopScene } from './scenes/ShopScene.js';

new Phaser.Game({
  type:Phaser.AUTO,
  width:GAME.width,
  height:GAME.height,
  parent:'game-container',
  backgroundColor:'#090711',
  antialias:true,
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  scene:[BootScene,MenuScene,MapScene,ShopScene,EncyclopediaScene,PlacementScene,BattleScene,RewardScene,SkillChoiceScene,RelicsScene]
});
