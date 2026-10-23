/* Pitch IQ — 7v7 rules as played in Halton (Ontario Soccer U10–U11).
   Checked against Ontario Soccer's Adapted Match Formats Laws (April 30, 2026) and the
   Peel Halton, Oakville and Burlington rule sheets. check: true marks rules that differ
   between clubs. Sources are listed in RESEARCH.md. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  PIQ.RULES = [
    { t: 'Who plays', d: 'Seven a side: six players and a keeper. In Ontario and in Peel Halton district play this is the U10 and U11 game. Burlington Soccer Club\'s house league is different: U9 and U10 play 7v7, but U11 moves up to 9v9 with throw-ins.', check: true },
    { t: 'The field', d: '30–36 m wide and 40–55 m long, 16 × 6 ft goals, size 4 ball. The penalty area is 20–24 m wide and 10–12 m deep, and there is no separate small box in front of goal.' },
    { t: 'How long', d: 'Two 25-minute halves (or four 12.5-minute quarters) with a 5-minute half-time. Unlimited subs at any stoppage. Oakville and Burlington give everyone equal playing time, and Oakville rotates every player through every position.' },
    { t: 'No offside', d: 'There\'s no offside in 7v7. You can stand anywhere, so stand somewhere smart.' },
    { t: 'Retreat line', d: 'On our goal kicks, when our keeper has the ball in her hands, and on our free kicks in our own third, the other team must get behind the retreat line (the one-third line). They can come forward once one of our players touches the ball, or it crosses the line or goes out. If our keeper plays it before they\'ve retreated, play just goes on.', lesson: 'shape-1' },
    { t: 'Kick-ins, not throw-ins', d: 'When the ball goes over the sideline, the other team restarts with a pass-in or dribble-in from where it went out. The ball must be still, and opponents stand at least 3 metres away. You can\'t score straight from a kick-in.', lesson: 'restarts-2' },
    { t: 'Goal kicks', d: 'Taken from anywhere in the penalty area after the attacking team knocks the ball over the goal line. The retreat line applies. Ontario lets you score straight from a goal kick; Oakville doesn\'t, and has the keeper take every goal kick for practice.', check: true, lesson: 'restarts-1' },
    { t: 'Corners', d: 'If a defender knocks it over her own goal line, the other team gets a corner kick from the corner nearest where it went out. Opponents stand 5 metres back. Short corners are encouraged at this age.', lesson: 'restarts-3' },
    { t: 'Kick-off', d: 'Everyone starts in their own half and the other team stands 5 metres back. A goal can be scored straight from a kick-off.', lesson: 'restarts-4' },
    { t: 'Free kicks', d: 'Every free kick in 7v7 is indirect: someone else has to touch the ball before it can go in. Opponents stand 5 metres back. If three or more defenders make a wall, attackers stay 1 metre away from it.', lesson: 'restarts-5' },
    { t: 'Penalty kicks', d: 'Fouls like tripping, pushing or a handball inside the box give a penalty kick. Ontario puts the penalty mark 8 m from goal; Oakville\'s house league sheet says 9 m.', check: true },
    { t: 'Keeper\'s hands', d: 'The keeper can use her hands only in her own box. She can\'t pick up a ball a teammate deliberately kicks back to her, or one straight from a teammate\'s kick-in.' },
    { t: 'Keeper kicks', d: 'Ontario recommends that keepers don\'t drop-kick. Oakville allows drop kicks but encourages playing out from the back.', check: true },
    { t: 'Heading', d: 'Canada Soccer\'s guidelines: heading is not taught in training at U10–U11, and coaches should use short corners and free kicks so it rarely happens in games.' },
    { t: 'No scores', d: 'No scores or standings at U10–U11 (Ontario, Peel Halton, Oakville and Burlington). It\'s about learning and having fun.' },
    { t: 'One referee', d: 'One referee, no assistants. Referees explain fouls to players and avoid yellow and red cards. Play until you hear the whistle.' }
  ];
})();
