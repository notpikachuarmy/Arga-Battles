export class BootScene extends Phaser.Scene {
  constructor(){super('Boot');}
  preload(){
    const A='assets/';
    const images={
      menuBg:'backgrounds/main_menu_background.png',battleBg:'backgrounds/battle_background.png',logo:'ui/logo.png',
      rune:'units/rune_tracer/rune_tracer_idle.png',formless:'units/formless/formless_idle.png',demon:'units/demon_blood/demon_blood_idle.png',
      runePortrait:'units/rune_tracer/rune_tracer_portrait.png',formlessPortrait:'units/formless/formless_portrait.png',demonPortrait:'units/demon_blood/demon_blood_portrait.png',
      move:'abilities/basic/move.png',attack:'abilities/basic/basic_attack.png',end:'abilities/basic/end_turn.png',skill:'abilities/basic/skill_placeholder.png',
      runeLightning:'abilities/rune_tracer/rune_spear_lightning.png',liquidArm:'abilities/formless/liquid_arm.png',bloodThorns:'abilities/demon_blood/devil_blood_thorns.png',
      hit:'effects/hit_physical.png',magic:'effects/hit_magic.png',heal:'effects/healing.png',lightningFx:'effects/lightning_spear.png',liquidFx:'effects/liquid_sweep.png',bloodFx:'effects/blood_thorns_buff.png',
      notpika:'blessings/blessing_notpikachu.png',hojafail:'blessings/blessing_hojafail.png',fotopie:'blessings/blessing_fotopie.png',chimecho:'blessings/blessing_chimecho.png',
      arrow:'ui/orientation_arrow.png',paralyzed:'status/paralyzed.png',strengthUp:'status/strength_up.png',defenseUp:'status/defense_up.png'
    };
    Object.entries(images).forEach(([key,path])=>this.load.image(key,A+path));
    this.load.on('complete',()=>document.getElementById('loading-message')?.remove());
  }
  create(){this.scene.start('Menu');}
}
