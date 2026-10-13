// PSYCH FACTS (src/game/psychfacts.js): short intro-psychology notes that townsfolk, TRAINER TIPS signs and
// bookshelves share. Written in our own words from general psychology knowledge (classic, well-replicated findings),
// with a light POKéMON spin. Each is [topic, text]; \f starts a new text box. Keep them short and accurate.
G.PSYCH_FACTS = [
  // ---------------- research methods ----------------
  ['Research methods', 'Towns with more ICE CREAM sales have more SWIMMER accidents. Ice cream isn\'t the cause: hot weather drives both.\fCorrelation does not prove causation!'],
  ['Research methods', 'A good experiment changes one thing on purpose and keeps everything else the same.\fRandom assignment makes the groups fair, so the change gets the credit.'],
  ['Research methods', 'In a double-blind study, neither the helpers nor the participants know who got the real treatment.\fThat keeps hopes and guesses from bending the results.'],
  ['Research methods', 'People who think they got a remedy often feel better, even from a sugar pill.\fThat\'s the placebo effect, and every good drug trial has to beat it.'],
  // ---------------- biopsychology ----------------
  ['Biopsychology', 'Your brain has about 86 billion neurons. They talk to each other with chemicals called neurotransmitters, across tiny gaps called synapses.'],
  ['Biopsychology', 'The left side of your brain mostly controls the right side of your body, and the right side controls the left.\fIt\'s a crossed wiring plan!'],
  ['Biopsychology', 'Long ago, a railroad worker named Phineas Gage survived an iron rod through his frontal lobe.\fFriends said his personality changed, which hinted at what that area does.'],
  ['Biopsychology', 'The brain keeps rewiring itself as you learn. That\'s neuroplasticity.\fEvery new BADGE strategy you practice leaves a mark!'],
  // ---------------- consciousness and sleep ----------------
  ['Sleep', 'Your body runs on a roughly 24-hour clock called a circadian rhythm.\fBright light at night can push it later, so dim the lights before bed!'],
  ['Sleep', 'Sleep comes in cycles of about 90 minutes. Most vivid dreams happen in REM sleep, when the eyes dart and the body\'s muscles go slack.'],
  ['Sleep', 'Teenagers\' body clocks shift later, so early mornings are extra hard for them.\fIt\'s biology, not laziness!'],
  ['Sleep', 'Sleep helps lock in what you learned that day.\fPulling an all-nighter before a GYM battle can cost you the strategy you studied!'],
  // ---------------- sensation and perception ----------------
  ['Perception', 'Stare at one thing long enough and you stop noticing it. That\'s sensory adaptation.\fIt\'s why you stop smelling the POKéMON CENTER\'s disinfectant.'],
  ['Perception', 'People often miss big changes in a scene if they happen during a blink or a cut. That\'s change blindness.\fYour eyes see less than you think!'],
  ['Perception', 'Weber\'s law: you notice a change by its proportion, not its size.\fOne extra POKé BALL in a bag of 2 feels big. In a bag of 99, you\'d never notice.'],
  ['Perception', 'Seeing a mouth say one sound while hearing another can make you hear a third sound. That\'s the McGurk effect.\fYour eyes help you listen!'],
  // ---------------- learning ----------------
  ['Learning', 'Pavlov\'s dogs learned to drool at a bell that came before food. That\'s classical conditioning.\fIt\'s why your GROWLITHE runs in when the food bowl rattles!'],
  ['Learning', 'Skinner showed that behavior followed by a reward happens more often.\fThat\'s operant conditioning: praise your POKéMON right after it does well!'],
  ['Learning', 'Rewards that come at random times, like a lucky fishing bite, build habits that are very hard to stop.\fThat\'s a variable-ratio schedule.'],
  ['Learning', 'Bandura showed that kids copy what they see adults do. That\'s observational learning.\fYoung TRAINERS learn a lot just by watching gym battles!'],
  ['Learning', 'When nothing you do seems to matter, you may stop trying, even when things change. Seligman called it learned helplessness.'],
  // ---------------- memory ----------------
  ['Memory', 'Short-term memory holds only a few items at once, often said to be about 7, give or take 2.\fGrouping helps: 151 is easier to hold than 1-5-1!'],
  ['Memory', 'Ebbinghaus found we forget most of new material within a day or two, unless we review it.\fThe forgetting curve drops fast, then levels off.'],
  ['Memory', 'Spreading study sessions out beats cramming. That\'s the spacing effect.\fA little practice each day trains a POKéDEX memory best!'],
  ['Memory', 'Testing yourself makes memories stronger than just rereading. That\'s the testing effect.\fQuiz yourself on type matchups instead of reading the chart again!'],
  ['Memory', 'In a list, you remember the first and last items best. That\'s the serial position effect.\fThe middle of the list gets lost!'],
  ['Memory', 'Loftus showed that the words in a question can change what witnesses remember.\fAsk how fast cars "smashed" and people recall broken glass that wasn\'t there.'],
  ['Memory', 'Memories feel solid, but each time you recall one you rebuild it, and small details can shift.\fConfidence is not proof of accuracy.'],
  // ---------------- thinking ----------------
  ['Thinking', 'We judge how common something is by how easily examples come to mind. That\'s the availability heuristic.\fNews of one SNORLAX blocking a road makes it feel like they\'re everywhere!'],
  ['Thinking', 'We notice facts that fit what we already believe, and skip the ones that don\'t. That\'s confirmation bias.\fGood scientists look for evidence against their ideas.'],
  ['Thinking', 'Once you see a tool one way, it\'s hard to see it another way. That\'s functional fixedness.\fA POKé BALL can be a paperweight too!'],
  ['Thinking', 'Naming the color of the ink is slow when the word names a different color. That\'s the Stroop effect.\fReading is so automatic it gets in the way!'],
  // ---------------- motivation and emotion ----------------
  ['Motivation', 'A little stress helps you perform, but too much hurts. That\'s the Yerkes-Dodson law.\fThe best GYM battles happen when you\'re alert, not panicked.'],
  ['Motivation', 'Maslow suggested people meet basic needs like food and safety before chasing bigger goals.\fEven a CHAMPION has to eat lunch first!'],
  ['Emotion', 'Across many cultures, people recognize the same basic facial expressions, like happiness, fear and anger.\fSmiles look alike from PALLET to CINNABAR.'],
  ['Emotion', 'Simply seeing something again and again tends to make people like it more. That\'s the mere-exposure effect.\fMaybe that\'s why the route music grows on you!'],
  // ---------------- development ----------------
  ['Development', 'Piaget noticed young kids think a tall thin glass holds more than a short wide one, even with the same water.\fThey haven\'t learned conservation yet.'],
  ['Development', 'Harlow\'s infant monkeys clung to a soft cloth mother over a wire one that gave milk.\fComfort, not only food, builds attachment.'],
  ['Development', 'Erikson described life as a series of stages, each with its own challenge, from trust in infancy to finding meaning in old age.'],
  ['Development', 'Babies are born able to hear the sounds of every language. By their first birthday they tune in to the sounds of the language around them.'],
  // ---------------- personality ----------------
  ['Personality', 'Many psychologists describe personality with five broad traits: openness, conscientiousness, extraversion, agreeableness and neuroticism.\fThe "Big Five"!'],
  ['Personality', 'A trait shows up as a tendency, not a rule. Even the most outgoing TRAINER has quiet days.'],
  // ---------------- social ----------------
  ['Social', 'We tend to blame other people\'s mistakes on their character, but our own on the situation.\fThat\'s the fundamental attribution error.'],
  ['Social', 'In Asch\'s studies, many people agreed with a group\'s obviously wrong answer about line lengths.\fWith even one ally, they spoke up far more.'],
  ['Social', 'The more people who see an emergency, the less likely any one of them is to help. That\'s the bystander effect.\fIf you need help, point to one person and ask them.'],
  ['Social', 'When our actions clash with our beliefs, we feel uneasy and often change the belief to match. Festinger called it cognitive dissonance.'],
  ['Social', 'People work less hard in a group than alone when no one can see their part. That\'s social loafing.\fGive every team member a clear job!'],
  // ---------------- stress and health ----------------
  ['Stress', 'Selye described stress in three stages: alarm, resistance, and, if it goes on too long, exhaustion.\fRest is part of training!'],
  ['Stress', 'Regular exercise, sleep and friends are some of the best-studied ways to handle stress.\fA walk on ROUTE 1 counts!'],
  // ---------------- disorders and therapy ----------------
  ['Mental health', 'Mental disorders are common: many people will have one at some point in life.\fGetting help is a strength, not a weakness.'],
  ['Mental health', 'Cognitive behavioral therapy helps people spot unhelpful thoughts and test them against the evidence, like a scientist would.'],
  ['Mental health', 'For a diagnosis, symptoms usually have to cause real distress or get in the way of daily life.\fA quirk is not a disorder.'],
];
