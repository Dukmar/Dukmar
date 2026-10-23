/* Pitch IQ — what the players say to her. {name} is her name, {team} her team colour.
   lessons: lessonId -> [[step, playerId, line, delaySeconds?]] (steps count from 0).
   The pools are used by the games, the quiz, the home screen and the tactics board. */
(function () {
  'use strict';
  var PIQ = window.PIQ;

  PIQ.TALK = {
    lessons: {
      'field-1': [[0, 'GK', 'Hi {name}! I\'m your keeper. We attack that way!'], [1, 'CM', 'Three thirds. Easy to remember!'], [3, 'LD', 'That line gives us room to pass, {name}.'], [4, 'GK', 'Only I get to use my hands, and only in here.'], [5, 'RW', 'Let\'s get smart, {name}!']],
      'field-2': [[1, 'GK', 'I\'ve got your back, {name}!'], [2, 'LD', 'We defend first, then spread out wide.'], [3, 'LW', 'Wide on the left, that\'s me!'], [5, 'ST', 'Pass it up to me, {name}!'], [6, 'RD', 'Every position is fun. Try them all!']],
      'field-3': [[0, 'LW', 'Everyone to the ball!'], [2, 'RW', 'Spread out! I\'ll go wide.'], [3, 'ST', 'I\'ll stay high, {name}.'], [4, 'CM', 'See? Lots of passes now!']],
      'shape-1': [[0, 'GK', 'Back up! Retreat line!'], [1, 'RD', 'Splitting wide, {name}!'], [2, 'CM', 'Keeper, I\'m here!'], [3, 'GK', 'Rolling it out wide. Safe!'], [4, 'RW', 'I\'m open down the line!']],
      'shape-2': [[0, 'CM', 'Everybody up with me!'], [1, 'LD', 'Up, but behind the ball.'], [2, 'GK', 'I\'m coming up too!'], [4, 'LW', 'Over here, {name}!']],
      'shape-3': [[0, 'RW', 'Get in the box, team!'], [1, 'LW', 'Back post! Back post!'], [2, 'CM', 'I\'ll wait at the top of the box.'], [4, 'LW', 'GOAL! Did you see that, {name}?', 2.2]],
      'shape-4': [[0, 'RW', 'Slide over, team!'], [1, 'LW', 'I\'m tucking in to help.'], [3, 'LW', 'My turn to press!', 1], [4, 'CM', 'Together, like a windshield wiper!']],
      'attack-1': [[0, 'CM', 'I can\'t pass to you there, {name}!'], [1, 'CM', 'Move into the open space!'], [2, 'CM', 'There you go, {name}!']],
      'attack-2': [[0, 'LD', 'Help! Who can I pass to?'], [1, 'CM', 'I\'m here inside!'], [2, 'ST', 'New angle, over here!', 1], [3, 'CM', 'Triangles everywhere, {name}!']],
      'attack-3': [[0, 'LD', 'Ball\'s coming, {name}! Have a look first!'], [2, 'LD', 'Smart look, {name}!'], [4, 'ST', 'You saw it before it happened!']],
      'attack-4': [[0, 'ST', 'Your call, {name}!'], [2, 'RW', 'I\'m open, {name}!'], [4, 'RW', 'Thanks, {name}!', 1.6]],
      'attack-5': [[0, 'RD', 'Ready, {name}? Open up!'], [2, 'ST', 'Great first touch!', 1.5], [3, 'RD', 'Can\'t turn? Pass it back to me!']],
      'attack-6': [[0, 'ST', 'Two of us, one of her. Let\'s go!'], [2, 'ST', 'Wall pass, here!'], [3, 'ST', 'One-two! Go, go, go!']],
      'attack-7': [[1, 'LW', 'Psst! I\'m all alone over here!'], [4, 'LW', 'Thanks for the switch!']],
      'defend-1': [[0, 'GK', 'Watch your player, {name}!'], [2, 'GK', 'Get goal-side, {name}! Quick!'], [3, 'GK', 'Perfect. Now you\'re protecting our goal.']],
      'defend-2': [[0, 'RW', 'I\'ll press her!'], [1, 'RD', 'I\'m right behind you!'], [2, 'LD', 'I\'m tucked in. Middle\'s covered.']],
      'defend-3': [[0, 'GK', 'Too many gaps, team!'], [1, 'GK', 'Squeeze! Squeeze!'], [2, 'CM', 'Nothing gets through the middle now!']],
      'defend-4': [[0, 'GK', 'Stay on your feet, {name}!'], [2, 'GK', 'Show her the sideline!'], [3, 'GK', 'Great defending, {name}!', 1.2]],
      'defend-5': [[0, 'GK', 'Get back, {name}! Get back!'], [3, 'GK', 'Thanks for running back, {name}!']],
      'switch-1': [[1, 'ST', 'Look up, {name}! I\'m going!', 0.6], [3, 'ST', 'Great pass!', 1]],
      'switch-2': [[0, 'RW', 'Don\'t worry, {name}! Win it back!'], [2, 'LD', 'We\'re getting back!'], [3, 'LD', 'Nice pressing, team!', 0.8]],
      'restarts-1': [[1, 'GK', 'Back up, please!'], [2, 'LD', 'Keeper, to me!'], [3, 'LD', 'Good touch, then look up.']],
      'restarts-2': [[1, 'RW', 'Quick, before they\'re ready!'], [2, 'CM', 'I\'m coming toward you!'], [4, 'CM', 'Your turn next time, {name}!']],
      'restarts-3': [[0, 'RW', 'Corner for us!'], [2, 'CM', 'Short corner, to me!'], [4, 'GK', 'I\'ll take care of the space in front of goal.']],
      'restarts-4': [[0, 'ST', 'Ready, {name}? Kick-off!'], [2, 'CM', 'Got it. Now spread out!']],
      'restarts-5': [[1, 'CM', 'Quick, they\'re not ready!'], [2, 'LW', 'Thanks! I\'m off!']],
      'keeper-1': [[0, 'LD', 'You\'ve got this, {name}!'], [2, 'LD', 'Smaller goal. Smart!'], [4, 'LD', 'WHAT A SAVE, {name}!', 1.2]],
      'keeper-2': [[1, 'LD', 'Keeper, out wide to me!'], [3, 'LD', 'Nice roll, {name}!']],
      'keeper-3': [[0, 'RD', 'Tell us what you see, {name}!']],
      'lead-1': [[5, 'CM', 'Thanks for the warning!', 0.8]],
      'lead-2': [[1, 'LW', 'Thanks, {name}. Next one!', 0.8], [3, 'LW', 'Going wide!'], [5, 'ST', 'Great game, {name}!']]
    },
    ambient: ['Pass it, {name}!', 'Let\'s go, {team}!', 'Spread out!', 'Nice touch!', 'I\'m open!', 'Time!', 'Over here!', 'Great pass!', 'Get wide!', 'Hi {name}!', 'Ready to learn, {name}?', 'Heads up!', 'Unlucky! Next one!', 'Talk to me!'],
    lessonStart: ['Hi {name}! Watch this one.', '{name}, let\'s learn this together!', 'Ready, {name}? Here we go!', 'This one\'s really useful, {name}.'],
    lessonEnd: ['Nice work, {name}!', 'You\'re getting smarter every lesson!', 'High five, {name}!', 'Coach would be proud!'],
    spotStart: ['Where should you be, {name}?', 'Find the smart spot, {name}!', 'Take your time, {name}.', 'Where\'s the ball? Where are we?'],
    spotGreat: ['Perfect spot, {name}! Here it comes!', 'Yes! Exactly right!', 'Smart, {name}!'],
    spotOk: ['Close enough, {name}!', 'Nearly there!', 'Good thinking!'],
    spotMiss: ['Over here next time, {name}!', 'Try that green spot!', 'No worries, now you know!'],
    mistakeFound: ['Oops, that was me! Thanks, {name}!', 'My bad! Moving now.', 'Good eye, {name}!'],
    mistakeNotMe: ['Not me, {name}! I\'m OK here.', 'I\'m in the right spot!'],
    mistakeWas: ['Oops, it was me!', 'It was me! Moving now.'],
    decideStart: ['Your call, {name}!', 'What\'s the smart play?', 'Look before you choose!'],
    decideBest: ['Great choice, {name}!', 'Yes! Smart play!', 'Love it, {name}!'],
    decideOk: ['That works, {name}.', 'Safe choice!'],
    decideBad: ['Ooh, risky, {name}!', 'Next time, look again!'],
    keeperStart: ['We trust you, {name}!', 'You\'ve got this, keeper!'],
    keeperSave: ['WHAT A SAVE, {name}!', 'Great hands!', 'Yes, keeper!'],
    keeperGoal: ['Shake it off, {name}!', 'Next one\'s yours!', 'Unlucky, keeper!'],
    quizRight: ['Yes, {name}!', 'You know it!', 'Smart!', 'Nailed it, {name}!'],
    quizWrong: ['No worries, {name}. Now you know!', 'Good try!', 'You\'ll get the next one!'],
    boardPick: ['Move me anywhere, {name}!', 'Where do you want me?', 'Drag me, or use the arrow keys!']
  };

  // a teammate (not "you") says a line from a pool; who = preferred player id
  PIQ.chat = function (stage, pool, who, secs) {
    var lines = PIQ.TALK[pool];
    if (!lines || !stage) return null;
    var id = who;
    if (!id || !stage.players[id]) {
      var mates = stage.list.filter(function (p) { return p.team === 'home' && p.id !== stage.youId && p.obj.visible; });
      if (!mates.length) return null;
      id = PIQ.pick(mates).id;
    }
    return PIQ.say(stage, id, PIQ.pick(lines), secs);
  };
})();
