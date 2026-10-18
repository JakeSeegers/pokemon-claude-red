// Countable criteria for STUDY CASES (src/game/dxcases.js): for each diagnosis whose criteria are a count of symptoms,
// the symptom groups, how many each needs, and the duration. Each case rolls dice for how many and which symptoms the
// person has (always enough to meet the criteria), and the case notes show the count against the threshold.
//
// Short summaries in our own words, as a study aid, from the DSM-5-TR criteria. Check them against the book (see
// docs/dxcases-review.md). Diagnoses whose criteria aren't a symptom count (OCD, Anorexia, Delusional Disorder...)
// are left out: their cases use the table's core features as before.
//
// Fields: duration; groups [{ name, min, minChild? (child and kid patients), minAdult? (adults), must? (indexes, at
// least one of them present), items }]; total? (all groups together need at least this many); severity? ([[count,
// label], ...] by the first group's count); presentations? (ADHD: which groups reach their threshold); specifiers?
// ([{ name, options }]: rolled by dice for each case, and asked in the SPECIFIER question 1 case in 4).
G.DX_CRITERIA = {
  'Major Depressive Disorder': { duration: 'nearly every day for 2 weeks or more', specifiers: [{ name: 'Episode', options: ['single episode', 'recurrent'] }], groups: [{ name: 'Depressive symptoms', min: 5, must: [0, 1], items: [
    'depressed mood most of the day', 'loss of interest or pleasure', 'appetite or weight change', 'sleeping too little or too much',
    'slowed down or agitated (others notice)', 'fatigue, low energy', 'worthlessness or excessive guilt', 'poor concentration or indecision',
    'recurring thoughts of death'] }] },
  'Persistent Depressive Disorder': { duration: 'most days for 2 years or more (1 year for children)', groups: [
    { name: 'Low mood', min: 1, items: ['depressed mood most days'] },
    { name: 'Other symptoms', min: 2, items: ['poor appetite or overeating', 'sleeping too little or too much', 'low energy', 'low self-esteem',
      'poor concentration or indecision', 'hopelessness'] }] },
  'Bipolar I Disorder': { duration: 'a manic episode: 1 week or more (or any length if hospitalized)', groups: [{ name: 'Manic symptoms', min: 3, items: [
    'grandiosity, inflated self-esteem', 'less need for sleep', 'more talkative, pressured speech', 'racing thoughts, jumping ideas',
    'easily distracted', 'more goal-directed activity or agitation', 'risky activities (spending, ventures)'] }] },
  'Bipolar II Disorder': { duration: 'a hypomanic episode of 4 days or more, and at least one major depressive episode', groups: [{ name: 'Hypomanic symptoms', min: 3, items: [
    'grandiosity, inflated self-esteem', 'less need for sleep', 'more talkative, pressured speech', 'racing thoughts, jumping ideas',
    'easily distracted', 'more goal-directed activity or agitation', 'risky activities (spending, ventures)'] }] },
  'Premenstrual Dysphoric Disorder': { duration: 'in the final week before menses in most cycles of the past year', total: 5, groups: [
    { name: 'Core mood symptoms', min: 1, items: ['marked mood swings', 'marked irritability or anger', 'marked low mood or hopelessness', 'marked anxiety or tension'] },
    { name: 'Other symptoms', min: 1, items: ['less interest in usual activities', 'poor concentration', 'tiredness, low energy', 'appetite change or cravings',
      'sleeping too much or too little', 'feeling overwhelmed', 'physical symptoms (breast tenderness, bloating)'] }] },
  'Generalized Anxiety Disorder': { duration: 'more days than not for 6 months or more', groups: [
    { name: 'Hard-to-control worry', min: 1, items: ['excessive worry about many things'] },
    { name: 'Anxiety symptoms', min: 3, minChild: 1, items: ['restless, keyed up', 'easily tired', 'trouble concentrating', 'irritability', 'muscle tension', 'sleep trouble'] }] },
  'Panic Disorder': { duration: 'recurrent unexpected attacks, then 1 month or more of worry or change', groups: [
    { name: 'Panic attack symptoms', min: 4, items: ['pounding heart', 'sweating', 'trembling', 'shortness of breath', 'choking feeling', 'chest pain',
      'nausea', 'dizziness', 'chills or heat', 'numbness or tingling', 'feeling unreal or detached', 'fear of losing control', 'fear of dying'] },
    { name: 'After the attacks', min: 1, items: ['worry about more attacks', 'changed behavior to avoid them'] }] },
  'Agoraphobia': { duration: '6 months or more', groups: [{ name: 'Feared situations', min: 2, items: [
    'public transport', 'open spaces', 'enclosed places (shops, theaters)', 'lines or crowds', 'outside the home alone'] }] },
  'Separation Anxiety Disorder': { duration: '4 weeks or more in children (6 months or more in adults)', groups: [{ name: 'Separation symptoms', min: 3, items: [
    'distress when separated', 'worry about losing a loved one', 'worry an event will cause separation', 'refuses to go out (school, work)',
    'afraid to be alone', 'refuses to sleep away from them', 'nightmares about separation', 'physical complaints at separation'] }] },
  'PTSD': { duration: 'more than 1 month after the event', groups: [
    { name: 'Intrusion', min: 1, items: ['intrusive memories', 'nightmares about it', 'flashbacks', 'distress at reminders', 'body reactions to reminders'] },
    { name: 'Avoidance', min: 1, items: ['avoids memories or feelings', 'avoids reminders (people, places)'] },
    { name: 'Mood and thinking', min: 2, items: ['can\'t recall a key part', 'negative beliefs about self or world', 'distorted blame', 'persistent fear, guilt or shame',
      'less interest in activities', 'feeling detached', 'can\'t feel positive emotions'] },
    { name: 'Arousal', min: 2, items: ['irritability or outbursts', 'reckless behavior', 'hypervigilance', 'easily startled', 'poor concentration', 'sleep trouble'] }] },
  'Acute Stress Disorder': { duration: '3 days to 1 month after the event', groups: [{ name: 'Symptoms (any category)', min: 9, items: [
    'intrusive memories', 'nightmares about it', 'flashbacks', 'distress or body reactions to reminders', 'can\'t feel positive emotions',
    'feels unreal, time slowed', 'can\'t recall a key part', 'avoids memories or feelings', 'avoids reminders', 'sleep trouble', 'irritability or outbursts',
    'hypervigilance', 'poor concentration', 'easily startled'] }] },
  'Prolonged Grief Disorder': { duration: '12 months or more after the death (6 months for children), nearly every day for the last month', groups: [
    { name: 'Grief response', min: 1, items: ['intense yearning for the person', 'preoccupation with the person'] },
    { name: 'Grief symptoms', min: 3, items: ['feels part of self died', 'disbelief about the death', 'avoids reminders', 'intense emotional pain',
      'can\'t re-engage with life', 'emotional numbness', 'life feels meaningless', 'intense loneliness'] }] },
  'Somatic Symptom Disorder': { duration: '6 months or more (the symptoms can vary)', groups: [{ name: 'Excess thoughts, feelings, behaviors', min: 1, items: [
    'thoughts out of proportion to the symptoms', 'high anxiety about health', 'too much time and energy on symptoms'] }] },
  'Insomnia Disorder': { duration: '3 nights a week or more, for 3 months or more', groups: [{ name: 'Sleep complaints', min: 1, items: [
    'trouble falling asleep', 'trouble staying asleep', 'waking too early'] }] },
  'Hypersomnolence Disorder': { duration: '3 times a week or more, for 3 months or more, despite 7+ hours of sleep', groups: [{ name: 'Sleepiness signs', min: 1, items: [
    'repeated naps or lapses into sleep in a day', 'long main sleep (9+ hours) that is not refreshing', 'hard to wake fully'] }] },
  'Binge-Eating Disorder': { duration: 'binges once a week or more for 3 months', groups: [{ name: 'Binge features', min: 3, items: [
    'eats much faster than normal', 'eats until uncomfortably full', 'eats large amounts when not hungry', 'eats alone from embarrassment', 'disgust or guilt afterward'] }] },
  'Oppositional Defiant Disorder': { duration: '6 months or more', groups: [{ name: 'Angry, defiant or vindictive', min: 4, items: [
    'often loses temper', 'touchy, easily annoyed', 'often angry and resentful', 'argues with adults', 'defies rules', 'annoys others on purpose',
    'blames others', 'spiteful or vindictive'] }] },
  'Conduct Disorder': { duration: 'in the past 12 months, at least one in the past 6 months',
    specifiers: [{ name: 'Onset', options: ['childhood-onset type (a problem before age 10)', 'adolescent-onset type (none before age 10)'] }], groups: [{ name: 'Conduct problems', min: 3, items: [
    'bullies or threatens', 'starts fights', 'used a weapon', 'physically cruel to people', 'cruel to animals', 'stole while confronting someone',
    'set fires to cause damage', 'destroyed property', 'broke into a house or car', 'lies to con others', 'stole without confrontation',
    'stays out at night before 13', 'ran away overnight', 'truant before 13'] }] },
  'Gambling Disorder': { duration: 'in the past 12 months', severity: [[4, 'mild'], [6, 'moderate'], [8, 'severe']], groups: [{ name: 'Gambling problems', min: 4, items: [
    'needs bigger bets for the thrill', 'restless when cutting down', 'failed attempts to stop', 'preoccupied with gambling', 'gambles when distressed',
    'chases losses', 'lies about gambling', 'risked a job or relationship', 'relies on others for money'] }] },
  'Substance Use Disorders': { duration: 'in the past 12 months', severity: [[2, 'mild'], [4, 'moderate'], [6, 'severe']], groups: [{ name: 'Use problems', min: 2, items: [
    'uses more or longer than meant to', 'can\'t cut down', 'much time getting, using, recovering', 'cravings', 'fails duties at work, school, home',
    'keeps using despite relationship problems', 'gave up activities', 'uses in dangerous situations', 'keeps using despite health problems',
    'tolerance', 'withdrawal'] }] },
  'Attention-Deficit/Hyperactivity Disorder': { duration: '6 months or more, several symptoms before age 12, in 2 or more settings', presentations: true, groups: [
    { name: 'Inattention', min: 6, minAdult: 5, items: ['careless mistakes', 'can\'t sustain attention', 'doesn\'t seem to listen', 'doesn\'t finish tasks', 'disorganized',
      'avoids long mental effort', 'loses things', 'easily distracted', 'forgetful in daily activities'] },
    { name: 'Hyperactivity-impulsivity', min: 6, minAdult: 5, items: ['fidgets', 'leaves seat', 'runs or climbs, or feels restless', 'can\'t play quietly',
      'always "on the go"', 'talks too much', 'blurts out answers', 'trouble waiting a turn', 'interrupts others'] }] },
  'Autism Spectrum Disorder': { duration: 'present from early development', groups: [
    { name: 'Social communication (all 3)', min: 3, items: ['little back-and-forth social exchange', 'trouble with nonverbal communication', 'trouble with relationships'] },
    { name: 'Restricted, repetitive', min: 2, items: ['repetitive movements or speech', 'insists on sameness, rigid routines', 'intense narrow interests', 'unusual sensory reactions'] }] },
  'Schizophrenia': { duration: '6 months or more, with 1 month of active symptoms', groups: [{ name: 'Psychotic symptoms', min: 2, must: [0, 1, 2], items: [
    'delusions', 'hallucinations', 'disorganized speech', 'grossly disorganized or catatonic behavior', 'negative symptoms (flat, little drive)'] }] },
  'Schizophreniform Disorder': { duration: '1 to 6 months', groups: [{ name: 'Psychotic symptoms', min: 2, must: [0, 1, 2], items: [
    'delusions', 'hallucinations', 'disorganized speech', 'grossly disorganized or catatonic behavior', 'negative symptoms (flat, little drive)'] }] },
  'Schizoaffective Disorder': { duration: 'a mood episode with psychosis, plus 2 weeks or more of psychosis without mood symptoms', groups: [{ name: 'Psychotic symptoms', min: 2, must: [0, 1, 2], items: [
    'delusions', 'hallucinations', 'disorganized speech', 'grossly disorganized or catatonic behavior', 'negative symptoms (flat, little drive)'] }] },
  'Brief Psychotic Disorder': { duration: '1 day to 1 month, then full return to normal', groups: [{ name: 'Psychotic symptoms', min: 1, must: [0, 1, 2], items: [
    'delusions', 'hallucinations', 'disorganized speech', 'grossly disorganized or catatonic behavior'] }] },
  'Unspecified Catatonia': { duration: 'during the episode', groups: [{ name: 'Catatonic signs', min: 3, items: [
    'stupor', 'catalepsy (holds a posture)', 'waxy flexibility', 'mutism', 'negativism', 'posturing', 'mannerisms', 'stereotypy', 'agitation',
    'grimacing', 'echolalia (repeats words)', 'echopraxia (copies movements)'] }] },
  'Disinhibited Social Engagement Disorder': { duration: 'after a pattern of insufficient care', groups: [{ name: 'Behaviors with strangers', min: 2, items: [
    'no shyness with unfamiliar adults', 'overly familiar talk or touch', 'doesn\'t check back with caregiver', 'goes off with a stranger readily'] }] },
  'Gender Dysphoria': { duration: '6 months or more', groups: [{ name: 'Incongruence', min: 2, items: [
    'body doesn\'t match experienced gender', 'wants to be rid of own sex characteristics', 'wants the other sex characteristics', 'wants to be another gender',
    'wants to be treated as another gender', 'feels the feelings of another gender'] }],
    child: { groups: [{ name: 'Incongruence (child)', min: 6, must: [0], items: ['strong desire to be another gender', 'prefers clothing of another gender',
      'prefers cross-gender roles in play', 'prefers toys and games of another gender', 'prefers playmates of another gender', 'rejects toys typical of own gender',
      'dislikes own anatomy', 'wants body to match experienced gender'] }] } },
  // specifiers only (these criteria aren't a symptom count): the dice roll the specifier, Claude shows the evidence
  'Obsessive-Compulsive Disorder': { duration: 'time-consuming (over 1 hour a day) or impairing', groups: [],
    specifiers: [{ name: 'Insight', options: ['good or fair insight', 'poor insight', 'absent insight / delusional beliefs'] }] },
  'Hoarding Disorder': { duration: 'persistent', groups: [],
    specifiers: [{ name: 'Insight', options: ['good or fair insight', 'poor insight', 'absent insight / delusional beliefs'] }] },
  'Specific Phobia': { duration: '6 months or more', groups: [],
    specifiers: [{ name: 'Type', options: ['animal', 'natural environment', 'blood-injection-injury', 'situational'] }] },
  'Anorexia Nervosa': { duration: 'the last 3 months set the type', groups: [],
    specifiers: [{ name: 'Type', options: ['restricting type', 'binge-eating/purging type'] }] },
  'Delusional Disorder': { duration: '1 month or more', groups: [],
    specifiers: [{ name: 'Type', options: ['erotomanic', 'grandiose', 'jealous', 'persecutory', 'somatic'] }] },
  'Social Anxiety Disorder': { duration: '6 months or more', groups: [],
    specifiers: [{ name: 'Specifier', options: ['performance only (speaking or performing in public)', 'not limited to performance'] }] },
  // personality disorders: a lasting pattern from early adulthood, across many situations
  'Paranoid Personality Disorder': { duration: 'lasting, from early adulthood', groups: [{ name: 'Distrust and suspicion', min: 4, items: [
    'suspects others will exploit or harm', 'doubts friends\' loyalty', 'won\'t confide in others', 'reads threats into remarks', 'holds grudges',
    'sees attacks on character, counterattacks', 'suspects partner\'s fidelity'] }] },
  'Schizoid Personality Disorder': { duration: 'lasting, from early adulthood', groups: [{ name: 'Detachment', min: 4, items: [
    'no wish for close relationships', 'chooses solitary activities', 'little interest in sex', 'few activities bring pleasure', 'no close friends',
    'indifferent to praise or criticism', 'emotionally cold or flat'] }] },
  'Schizotypal Personality Disorder': { duration: 'lasting, from early adulthood', groups: [{ name: 'Odd and uneasy with closeness', min: 5, items: [
    'ideas of reference', 'odd beliefs, magical thinking', 'unusual perceptions', 'odd thinking and speech', 'suspiciousness', 'narrow or odd affect',
    'odd behavior or appearance', 'no close friends', 'social anxiety that doesn\'t ease'] }] },
  'Antisocial Personality Disorder': { duration: 'since age 15, in someone 18 or older (with conduct disorder before 15)', groups: [{ name: 'Disregard for others', min: 3, items: [
    'breaks laws repeatedly', 'deceitful, cons others', 'impulsive, no planning', 'irritable, aggressive, fights', 'reckless about safety',
    'irresponsible with work or money', 'no remorse'] }] },
  'Borderline Personality Disorder': { duration: 'lasting, from early adulthood', groups: [{ name: 'Instability', min: 5, items: [
    'frantic efforts to avoid abandonment', 'unstable, intense relationships', 'unstable self-image', 'impulsive in 2+ risky areas',
    'recurrent self-harm or suicidal behavior', 'reactive mood swings', 'chronic emptiness', 'intense anger', 'brief stress paranoia or dissociation'] }] },
  'Histrionic Personality Disorder': { duration: 'lasting, from early adulthood', groups: [{ name: 'Attention seeking', min: 5, items: [
    'uneasy when not the center of attention', 'inappropriately seductive', 'shallow, shifting emotions', 'uses looks to draw attention',
    'vague, impressionistic speech', 'theatrical, exaggerated emotion', 'easily influenced', 'sees relationships as closer than they are'] }] },
  'Narcissistic Personality Disorder': { duration: 'lasting, from early adulthood', groups: [{ name: 'Grandiosity and need for admiration', min: 5, items: [
    'grandiose self-importance', 'fantasies of success or power', 'believes they are special', 'needs excessive admiration', 'sense of entitlement',
    'exploits others', 'lacks empathy', 'envious, or thinks others envy them', 'arrogant'] }] },
  'Avoidant Personality Disorder': { duration: 'lasting, from early adulthood', groups: [{ name: 'Inhibition and fear of rejection', min: 4, items: [
    'avoids jobs with much contact', 'won\'t get involved unless sure of being liked', 'holds back in close relationships', 'preoccupied with criticism',
    'inhibited in new situations', 'sees self as inept or inferior', 'reluctant to take risks'] }] },
  'Dependent Personality Disorder': { duration: 'lasting, from early adulthood', groups: [{ name: 'Need to be taken care of', min: 5, items: [
    'needs advice for everyday decisions', 'needs others to take responsibility', 'can\'t voice disagreement', 'hard to start things alone',
    'goes to great lengths for support', 'uncomfortable alone', 'rushes into a new relationship', 'fears being left alone'] }] },
  'Obsessive-Compulsive Personality Disorder': { duration: 'lasting, from early adulthood', groups: [{ name: 'Order and control', min: 4, items: [
    'lost in details, rules, lists', 'perfectionism blocks finishing', 'work over leisure and friends', 'rigid about morals', 'can\'t throw out worthless things',
    'won\'t delegate', 'miserly', 'rigid and stubborn'] }] },
  // intoxication and withdrawal
  'Alcohol Intoxication': { duration: 'during or soon after drinking', groups: [{ name: 'Signs', min: 1, items: [
    'slurred speech', 'poor coordination', 'unsteady walk', 'nystagmus', 'poor attention or memory', 'stupor or coma'] }] },
  'Alcohol Withdrawal': { duration: 'hours to days after heavy, long use stops', groups: [{ name: 'Signs', min: 2, items: [
    'sweating or fast pulse', 'hand tremor', 'insomnia', 'nausea or vomiting', 'brief hallucinations', 'agitation', 'anxiety', 'seizures'] }] },
  'Cannabis Intoxication': { duration: 'within 2 hours of use', groups: [{ name: 'Signs', min: 2, items: ['red eyes', 'more appetite', 'dry mouth', 'fast heartbeat'] }] },
  'Cannabis Withdrawal': { duration: 'within about a week after heavy use stops', groups: [{ name: 'Signs', min: 3, items: [
    'irritability or anger', 'nervousness', 'sleep trouble', 'less appetite', 'restlessness', 'low mood', 'physical discomfort (stomach pain, shakes, sweats)'] }] },
  'Opioid Intoxication': { duration: 'during or soon after use', groups: [
    { name: 'Pupils', min: 1, items: ['pinpoint pupils'] },
    { name: 'Other signs', min: 1, items: ['drowsiness or coma', 'slurred speech', 'poor attention or memory'] }] },
  'Opioid Withdrawal': { duration: 'minutes to days after use stops or is reduced', groups: [{ name: 'Signs', min: 3, items: [
    'low, uneasy mood', 'nausea or vomiting', 'muscle aches', 'teary eyes or runny nose', 'wide pupils, goosebumps or sweating', 'diarrhea', 'yawning', 'fever', 'insomnia'] }] },
  'Stimulant Intoxication': { duration: 'during or soon after use', groups: [{ name: 'Signs', min: 2, items: [
    'fast or slow heartbeat', 'wide pupils', 'blood pressure change', 'sweating or chills', 'nausea or vomiting', 'weight loss', 'agitation or slowing',
    'weakness, chest pain or irregular heartbeat', 'confusion or seizures'] }] },
  'Stimulant Withdrawal': { duration: 'hours to days after heavy use stops', groups: [
    { name: 'Mood', min: 1, items: ['low, uneasy mood'] },
    { name: 'Other signs', min: 2, items: ['fatigue', 'vivid, unpleasant dreams', 'sleeping too little or too much', 'more appetite', 'slowing or agitation'] }] },
  'Sedative, Hypnotic, or Anxiolytic Intoxication': { duration: 'during or soon after use', groups: [{ name: 'Signs', min: 1, items: [
    'slurred speech', 'poor coordination', 'unsteady walk', 'nystagmus', 'poor attention or memory', 'stupor or coma'] }] },
  'Sedative, Hypnotic, or Anxiolytic Withdrawal': { duration: 'hours to days after long use stops', groups: [{ name: 'Signs', min: 2, items: [
    'sweating or fast pulse', 'hand tremor', 'insomnia', 'nausea or vomiting', 'brief hallucinations', 'agitation', 'anxiety', 'seizures'] }] },
  'Caffeine Intoxication': { duration: 'during or soon after a large amount (usually over 250 mg)', groups: [{ name: 'Signs', min: 5, items: [
    'restlessness', 'nervousness', 'excitement', 'insomnia', 'flushed face', 'frequent urination', 'upset stomach', 'muscle twitching', 'rambling speech',
    'fast or irregular heartbeat', 'bursts of tirelessness', 'agitation'] }] },
  'Caffeine Withdrawal': { duration: 'within 24 hours after daily use stops', groups: [{ name: 'Signs', min: 3, items: [
    'headache', 'fatigue or drowsiness', 'low or irritable mood', 'poor concentration', 'flu-like symptoms'] }] },
  'Tobacco Withdrawal': { duration: 'within 24 hours after daily use stops', groups: [{ name: 'Signs', min: 4, items: [
    'irritability or anger', 'anxiety', 'poor concentration', 'more appetite', 'restlessness', 'low mood', 'insomnia'] }] },
};
