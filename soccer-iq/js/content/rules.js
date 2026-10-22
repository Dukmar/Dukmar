/* Pitch IQ — 7v7 rules as played in Halton (Ontario Soccer U10–U11).
   check: true marks rules that differ between clubs or that I could not confirm
   from a primary page. Sources are listed in RESEARCH.md. */
(function () {
  'use strict';
  var PIQ = window.PIQ;
  PIQ.RULES = [
    { t: 'Who plays', d: 'Seven a side: six players and a keeper. In Ontario this is the U10 and U11 game. Burlington Soccer Club\'s house league moves U11 to 9v9, so check your club.', check: true },
    { t: 'The field', d: 'About 30–36 m wide and 40–55 m long, with 16 × 6 ft goals and a size 4 ball. Parks vary.' },
    { t: 'How long', d: 'Usually two halves of 25 minutes. Lots of subs, and everyone gets fair playing time.' },
    { t: 'No offside', d: 'There\'s no offside in 7v7. You can stand anywhere, so stand somewhere smart.' },
    { t: 'Retreat line', d: 'On our goal kicks, or when our keeper has the ball in her hands, the other team must get behind the retreat line (the one-third line at U10–U11). They can come forward once one of our players touches the ball, or it crosses the line or goes out. If our keeper plays it before they\'ve retreated, play just goes on.', lesson: 'shape-1' },
    { t: 'Kick-ins, not throw-ins', d: 'When the ball goes over the sideline, the other team restarts with a pass-in or dribble-in from the line. The ball must be still. You can\'t score straight from a kick-in. Opponents back off a few metres (club rule sheets say 3 m or 2 yards).', check: true, lesson: 'restarts-2' },
    { t: 'Goal kicks', d: 'When the attacking team knocks the ball over the goal line, the defending team restarts with a goal kick near its own goal. The retreat line applies.', lesson: 'restarts-1' },
    { t: 'Corners', d: 'If a defender knocks it over her own goal line, the other team gets a corner kick. Short corners are encouraged at this age.', lesson: 'restarts-3' },
    { t: 'Kick-off', d: 'Everyone starts in their own half. A goal can be scored straight from a kick-off.', lesson: 'restarts-4' },
    { t: 'Free kicks', d: 'Given for fouls like tripping, pushing or handballs. Older Ontario rules made all 7v7 free kicks indirect except penalties, with opponents 5 m back. Newer rules follow the full Laws "where applicable", so ask your coach.', check: true, lesson: 'restarts-5' },
    { t: 'Penalty kicks', d: 'Taken from the penalty mark, 8 m from goal.' },
    { t: 'Keeper kicks', d: 'Ontario recommends against drop kicks. Some clubs (like Oakville at U10–U11) allow them but want teams to play out from the back.', check: true },
    { t: 'Heading', d: 'Canada Soccer\'s 2025 guidelines: heading is not taught in training at U10–U11, and coaches should use short corners and free kicks so it rarely happens in games.' },
    { t: 'No scores', d: 'Ontario grassroots soccer doesn\'t keep scores or standings through U13. It\'s about learning and having fun.' },
    { t: 'One referee', d: 'One referee, no assistants. Play until you hear the whistle.' }
  ];
})();
