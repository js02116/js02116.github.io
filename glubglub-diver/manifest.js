// 게임에서 쓰는 이미지 목록 (tools/build_assets.py 도 이 파일을 읽음 — JSON 형식 유지)
// optional = 아직 없어도 되는 이미지 (파일이 생기면 자동으로 쓰임)
// scale = 원본 대비 화면 배율. 같은 시트에서 나온 이미지는 같은 배율을 써서 크기 비율 유지
window.GGD_MANIFEST = [
  {"dir": "sprites/diver", "scale": 0.127, "names": ["diver_idle", "diver_fall", "diver_jump", "diver_land", "diver_hurt", "diver_dead"]},
  {"dir": "sprites/diver", "scale": 0.127, "optional": true, "names": ["diver_walk_1", "diver_walk_2", "diver_walk_3", "diver_walk_4", "diver_swim_1", "diver_swim_2", "diver_stand_1", "diver_stand_2"]},
  {"dir": "sprites/platforms", "scale": 0.23, "names": ["plank_wood", "plank_moss", "plank_current", "plank_crumble", "plank_crumble_broken", "plank_urchin", "turtle_carrier", "jelly_spring", "jelly_spring_pressed"]},
  {"dir": "sprites/creatures", "scale": 0.2, "names": ["urchin_purple_grin", "urchin_orange_wink", "urchin_purple_tongue", "urchin_red_angry", "urchin_red_furious", "urchin_orange_smirk"]},
  {"dir": "sprites/creatures", "scale": 0.15, "names": ["jellyfish_purple", "jellyfish_orange", "jellyfish_yellow", "jellyfish_red"]},
  {"dir": "sprites/creatures", "scale": 0.062, "names": ["clam_open", "clam_closed"]},
  {"dir": "sprites/creatures", "scale": 0.075, "names": ["fish_blue", "fish_orange", "fish_green"]},
  {"dir": "sprites/items", "scale": 0.08, "names": ["pearl", "oxygen_tank"]},
  {"dir": "sprites/items", "scale": 0.06, "names": ["starfish_gold", "conch_shell", "sapphire", "diamond"]},
  {"dir": "sprites/props", "scale": 0.07, "names": ["sign_depth"]},
  {"dir": "sprites/items", "scale": 0.11, "names": ["chest_closed", "chest_open"]},
  {"dir": "sprites/items", "scale": 0.075, "names": ["bubble_large", "bubble_medium"]},
  {"dir": "sprites/items", "scale": 0.065, "names": ["heart"]},
  {"dir": "sprites/items", "scale": 0.12, "names": ["fx_sparkle", "fx_splash", "fx_dust", "fx_current"]},
  {"dir": "ui", "scale": 0.5, "names": ["logo"]},
  {"dir": "ui", "scale": 0.27, "names": ["panel_score", "panel_depth"]},
  {"dir": "ui", "scale": 0.24, "names": ["oxygen_gauge", "oxygen_needle"]},
  {"dir": "ui", "scale": 0.28, "names": ["btn_play", "btn_retry", "btn_pause", "btn_home"]},
  {"dir": "ui", "scale": 0.62, "names": ["panel_gameover"]},
  {"dir": "ui", "scale": 0.12, "names": ["num_0", "num_1", "num_2", "num_3", "num_4", "num_5", "num_6", "num_7", "num_8", "num_9"]},
  {"dir": "backgrounds", "scale": 0.3515625, "names": ["bg_main"], "jpeg": true}
];
