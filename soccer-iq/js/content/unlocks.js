/* Pitch IQ — Locker Room items. Coins come from playing (every XP point earns a coin),
   and spending coins never lowers her level. cost 0 = owned from the start. */
(function () {
  'use strict';
  var PIQ = window.PIQ;

  PIQ.UNLOCK_CATS = [
    { id: 'kit', name: 'Kit', blurb: 'Your whole team wears it.' },
    { id: 'boots', name: 'Boots', blurb: 'Only you wear these.' },
    { id: 'ball', name: 'Ball', blurb: 'Used in every scene.' },
    { id: 'celebrate', name: 'Celebration', blurb: 'What you do after a goal.' },
    { id: 'stadium', name: 'Stadium', blurb: 'Time of day for every match.' }
  ];

  PIQ.UNLOCKS = {
    kit: [
      { id: 'plain', name: 'Classic', cost: 0 },
      { id: 'sleeves', name: 'Contrast sleeves', cost: 60 },
      { id: 'stripes', name: 'Stripes', cost: 80 },
      { id: 'hoops', name: 'Hoops', cost: 80 },
      { id: 'sash', name: 'Sash', cost: 120 },
      { id: 'halves', name: 'Halves', cost: 120 },
      { id: 'chevron', name: 'Chevron', cost: 150 }
    ],
    boots: [
      { id: 'black', name: 'Black', cost: 0 },
      { id: 'white', name: 'White', cost: 40 },
      { id: 'pink', name: 'Hot pink', cost: 60 },
      { id: 'lime', name: 'Neon lime', cost: 60 },
      { id: 'orange', name: 'Orange', cost: 60 },
      { id: 'gold', name: 'Gold', cost: 150 }
    ],
    ball: [
      { id: 'classic', name: 'Classic', cost: 0 },
      { id: 'team', name: 'Team colours', cost: 50 },
      { id: 'neon', name: 'Neon', cost: 70 },
      { id: 'rainbow', name: 'Rainbow', cost: 100 },
      { id: 'galaxy', name: 'Galaxy', cost: 140 },
      { id: 'gold', name: 'Gold', cost: 200 }
    ],
    celebrate: [
      { id: 'jump', name: 'Jump for joy', cost: 0 },
      { id: 'champion', name: 'Champion arms', cost: 60 },
      { id: 'spin', name: 'Spin', cost: 80 },
      { id: 'airplane', name: 'Airplane', cost: 110 },
      { id: 'kneeslide', name: 'Knee slide', cost: 150 }
    ],
    stadium: [
      { id: 'day', name: 'Sunny day', cost: 0 },
      { id: 'sunset', name: 'Sunset', cost: 200 },
      { id: 'night', name: 'Night under the lights', cost: 300 }
    ]
  };

  // swatch colours for the Locker Room cards
  PIQ.UNLOCK_SWATCH = {
    boots: PIQ.BOOTS,
    ball: { classic: 0xffffff, team: null, neon: 0xc6ff3b, rainbow: 0xff9a3d, galaxy: 0x1a1446, gold: 0xf2c230 },
    stadium: { day: 0x7cc8ff, sunset: 0xf59a6b, night: 0x101a38 }
  };
})();
