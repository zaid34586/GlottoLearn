-- ============================================================
-- GlottoLearn — Seed Content: "French for Beginners"
-- Run ONCE in Supabase SQL Editor.
-- Adds paddle_price_id column + full beginner course content.
-- Idempotent: safe to re-run (skips existing modules/lessons/quiz).
-- ============================================================

alter table public.courses add column if not exists paddle_price_id text;

do $seed$
declare
  v_course uuid;
  v_lang bigint;
  v_m1 uuid; v_m2 uuid; v_m3 uuid; v_m4 uuid;
  v_quiz uuid;
begin
  select id into v_lang from public.languages where code = 'fr' limit 1;

  select id into v_course from public.courses where title = 'French for Beginners' limit 1;
  if v_course is null then
    insert into public.courses (title, description, language_id, level, price_inr, status)
    values (
      'French for Beginners',
      'A complete beginner course: greetings, everyday conversation, essential grammar and real-life situations — with reading lessons, quizzes and live classes.',
      v_lang, 'Beginner', 2000, 'published'
    )
    returning id into v_course;
  end if;

  ---------------- MODULE 1 ----------------
  if not exists (select 1 from public.modules where course_id = v_course and title = 'Module 1 · Greetings & First Words') then
    insert into public.modules (course_id, title, position)
    values (v_course, 'Module 1 · Greetings & First Words', 1) returning id into v_m1;

    insert into public.lessons (module_id, course_id, title, type, content, duration_sec, position) values
    (v_m1, v_course, 'Lesson 1 · Saying Hello — Bonjour!', 'material', $l1$
Welcome to your very first French lesson! In this lesson you will learn how to greet people the French way.

VOCABULARY
• Bonjour — Hello / Good day (used during daytime)
• Bonsoir — Good evening
• Salut — Hi (informal, for friends)
• Au revoir — Goodbye
• À bientôt — See you soon

HOW IT WORKS
French people greet every time they enter a shop, a classroom, or meet someone. Saying just "Bonjour" with a smile is considered polite and friendly. In the evening (after around 6 pm), switch from "Bonjour" to "Bonsoir".

QUICK TIP
"Bonjour" literally means "good day" (bon = good, jour = day). Easy to remember!

PRACTICE
1. Greet your friend in the morning: ______ ?
2. Your class ends — how do you say goodbye?
3. Which greeting is informal?
    $l1$, 420, 1),

    (v_m1, v_course, 'Lesson 2 · Introducing Yourself — Je m''appelle…', 'material', $l2$
Now that you can greet, let's introduce ourselves!

KEY PHRASES
• Comment vous appelez-vous ? — What is your name? (formal)
• Comment tu t'appelles ? — What is your name? (informal)
• Je m'appelle… — My name is…
• Enchanté(e) ! — Nice to meet you!
• Je suis indien / indienne — I am Indian

EXAMPLE DIALOGUE
— Bonjour ! Je m'appelle Aarav. Et vous ?
— Bonjour Aarav ! Moi, c'est Sophie. Enchantée !
— Enchanté !

GRAMMAR NOTE
"Je m'appelle" literally means "I call myself". French people use this instead of "My name is".

PRACTICE
1. Introduce yourself in one sentence.
2. Ask your teacher's name politely.
3. Say "Nice to meet you" (if you are a girl, write it with -e).
    $l2$, 480, 2),

    (v_m1, v_course, 'Lesson 3 · Alphabet & Pronunciation Rules', 'material', $l3$
French pronunciation has simple rules — learn them once and you can read any word!

THE GOLDEN RULES
1. Final consonants are usually silent: Paris → "Paree", tout → "too".
2. "ou" sounds like "oo" in "moon": vous → "voo".
3. "oi" sounds like "wa": moi → "mwa".
4. "ai" / "ei" sound like "ay": mais → "meh".
5. "an/en" make a nasal sound (like saying "aa" through your nose): enfant → "aa(n)fa(n)".
6. "é" = sharp "ay" (café), "è" = open "eh" (père).

ACCENTS
French uses accents: é (aigu), è (grave), ê (circonflexe), ç (cedilla — makes "c" sound like "s": français).

PRACTICE — try reading these aloud:
• Bonjour (hello) • Merci (thank you) • École (school) • Garçon (boy) • Français (French)
    $l3$, 540, 3),

    (v_m1, v_course, 'Lesson 4 · Numbers 0 to 20', 'material', $l4$
Numbers are everywhere — prices, phone numbers, time. Let's master 0–20!

THE NUMBERS
0 zéro • 1 un • 2 deux • 3 trois • 4 quatre • 5 cinq
6 six • 7 sept • 8 huit • 9 neuf • 10 dix
11 onze • 12 douze • 13 treize • 14 quatorze • 15 quinze
16 seize • 17 dix-sept • 18 dix-huit • 19 dix-neuf • 20 vingt

PATTERN TRICK
Notice 17, 18, 19? They are just "10+7", "10+8", "10+9" — dix-sept, dix-huit, dix-neuf. Once you know 1–10, the teens build themselves!

PRACTICE
1. Count from 1 to 10 aloud, twice.
2. Write your age in French: J'ai ___ ans.
3. What is "dix-neuf" in digits?
    $l4$, 420, 4);
  end if;

  ---------------- MODULE 2 ----------------
  if not exists (select 1 from public.modules where course_id = v_course and title = 'Module 2 · Everyday Conversation') then
    insert into public.modules (course_id, title, position)
    values (v_course, 'Module 2 · Everyday Conversation', 2) returning id into v_m2;

    insert into public.lessons (module_id, course_id, title, type, content, duration_sec, position) values
    (v_m2, v_course, 'Lesson 1 · Polite Words — Merci, S''il vous plaît', 'material', $m2l1$
Politeness opens doors in France. These little words will be your best friends!

MUST-KNOW WORDS
• Merci (beaucoup) — Thank you (very much)
• S'il vous plaît — Please (formal)
• S'il te plaît — Please (informal)
• Excusez-moi — Excuse me
• Pardon — Sorry / Pardon
• De rien — You're welcome
• Je vous en prie — You're very welcome (very polite)

CULTURE NOTE
In shops, always start with "Bonjour" and end with "Merci, au revoir !". Skipping greetings is considered rude in France.

PRACTICE
1. Someone gives you a gift — what do you say?
2. Ask for water politely: "Un verre d'eau, ______ ?"
3. Reply to "Merci" in two different ways.
    $m2l1$, 420, 1),

    (v_m2, v_course, 'Lesson 2 · Asking Simple Questions', 'material', $m2l2$
Questions help you survive any conversation. Here are the three easy ways to ask.

METHOD 1 — Rising intonation (easiest!)
"Vous parlez anglais ?" — You speak English? (just raise your voice at the end)

METHOD 2 — Est-ce que (very common)
"Est-ce que vous parlez anglais ?" — Do you speak English?

METHOD 3 — Question words
• Qu'est-ce que… ? — What…?
• Où… ? — Where…?
• Quand… ? — When…?
• Pourquoi… ? — Why…?
• Comment… ? — How…?
• Qui… ? — Who…?

EXAMPLES
• Où est la gare ? — Where is the station?
• Qu'est-ce que c'est ? — What is this?
• Comment ça va ? — How are you?

PRACTICE
1. Ask "What is this?" in French.
2. Ask your friend how they are (informally).
    $m2l2$, 480, 2),

    (v_m2, v_course, 'Lesson 3 · Days, Months & Time', 'material', $m2l3$
Let's learn to talk about your week and your day!

DAYS OF THE WEEK
lundi (Monday) • mardi (Tuesday) • mercredi (Wednesday) • jeudi (Thursday) • vendredi (Friday) • samedi (Saturday) • dimanche (Sunday)

MONTHS
janvier, février, mars, avril, mai, juin, juillet, août, septembre, octobre, novembre, décembre

USEFUL TIME PHRASES
• Aujourd'hui — Today
• Demain — Tomorrow
• Hier — Yesterday
• Quel jour sommes-nous ? — What day is it?
• Il est trois heures. — It is 3 o'clock.
• Il est midi. — It is noon.

NOTE: In French, days and months start with a SMALL letter (lundi, janvier) — unlike English!

PRACTICE
1. Write your birthday month in French.
2. Say "Today is Monday" — Aujourd'hui, c'est ______.
    $m2l3$, 420, 3),

    (v_m2, v_course, 'Lesson 4 · Talking About Weather', 'material', $m2l4$
Weather is the world's favourite small talk — and the French love it too!

WEATHER PHRASES (il fait… / il y a…)
• Il fait beau. — The weather is nice.
• Il fait chaud. — It is hot.
• Il fait froid. — It is cold.
• Il pleut. — It is raining.
• Il neige. — It is snowing.
• Il y a du vent. — It is windy.
• Il y a du soleil. — It is sunny.

DIALOGUE
— Quel temps fait-il aujourd'hui ?
— Il fait chaud et il y a du soleil !
— Parfait pour un pique-nique !

PRACTICE
1. Describe today's weather in your city (2 sentences).
2. What season do you like? Write: J'aime… (I like…)
    $m2l4$, 360, 4);
  end if;

  ---------------- MODULE 3 ----------------
  if not exists (select 1 from public.modules where course_id = v_course and title = 'Module 3 · Grammar Foundations') then
    insert into public.modules (course_id, title, position)
    values (v_course, 'Module 3 · Grammar Foundations', 3) returning id into v_m3;

    insert into public.lessons (module_id, course_id, title, type, content, duration_sec, position) values
    (v_m3, v_course, 'Lesson 1 · Articles — le, la, les', 'material', $m3l1$
Every French noun needs an article. The trick? Every noun has a gender!

THE DEFINITE ARTICLES
• le — the (masculine singular): le livre (the book)
• la — the (feminine singular): la table (the table)
• l' — the (before a vowel): l'école (the school)
• les — the (all plurals): les livres, les tables

HOW TO KNOW THE GENDER?
Sadly, there's no perfect rule — learn each word WITH its article from day one: not "livre" but "le livre". Common endings help: words ending in -tion, -té, -ette are usually feminine; words ending in -age, -ment are usually masculine.

INDEFINITE ARTICLES (a / an)
• un (masculine) — un stylo (a pen)
• une (feminine) — une porte (a door)
• des (plural) — des amis (some friends)

PRACTICE
1. Say "the school" in French.
2. Is "maison" (house) le or la? (Answer: la maison!)
3. Make it plural: les ______.
    $m3l1$, 540, 1),

    (v_m3, v_course, 'Lesson 2 · Subject Pronouns & Être (to be)', 'material', $m3l2$
Time to build your first full sentences with the most important verb: être (to be).

SUBJECT PRONOUNS
• je — I • tu — you (informal) • il/elle — he/she
• nous — we • vous — you (formal/plural) • ils/elles — they (m/f)

ÊTRE — PRESENT TENSE
• je suis — I am
• tu es — you are
• il/elle est — he/she is
• nous sommes — we are
• vous êtes — you are
• ils/elles sont — they are

EXAMPLES
• Je suis étudiant. — I am a student.
• Elle est professeure. — She is a teacher.
• Nous sommes amis. — We are friends.
• Vous êtes les bienvenus. — You are welcome.

PRACTICE
1. Write: "I am happy" → Je suis ______. (heureux/heureuse)
2. Translate: "They are in Paris."
    $m3l2$, 540, 2),

    (v_m3, v_course, 'Lesson 3 · -ER Verbs (Present Tense)', 'material', $m3l3$
Good news: 90% of French verbs end in -er, and they ALL follow one pattern!

THE PATTERN — PARLER (to speak)
Remove -er, add endings:
• je parle — I speak
• tu parles — you speak
• il/elle parle — he/she speaks
• nous parlons — we speak
• vous parlez — you speak (formal/plural)
• ils/elles parlent — they speak

MORE -ER VERBS TO USE
• manger (to eat) → je mange
• travailler (to work) → je travaille
• habiter (to live) → j'habite à Delhi. (I live in Delhi.)
• étudier (to study) → j'étudie le français.
• aimer (to like/love) → j'aime le chocolat !

SPEAKING TRICK
With "je" + verb starting with a vowel, je becomes j': j'aime, j'habite, j'étudie.

PRACTICE
1. Conjugate "manger" for "nous".
2. Write one sentence about what you like: J'aime…
    $m3l3$, 600, 3),

    (v_m3, v_course, 'Lesson 4 · Negation — ne…pas', 'material', $m3l4$
Saying "no" in French is a sandwich: the verb goes between ne…pas!

THE RULE
ne + VERB + pas = not
• Je parle → Je NE parle PAS. — I don't speak.
• Il mange → Il NE mange PAS. — He doesn't eat.
• Elle est ici → Elle N'est PAS ici. — She is not here.

NOTE: Before a vowel, ne becomes n'.

EXAMPLES IN ACTION
• Je ne comprends pas. — I don't understand. (Super useful!)
• Je ne sais pas. — I don't know.
• Nous n'habitons pas à Paris. — We don't live in Paris.

PRACTICE
1. Make negative: "Je parle anglais." → ______
2. How do you say "I don't know" in French?
    $m3l4$, 420, 4);
  end if;

  ---------------- MODULE 4 ----------------
  if not exists (select 1 from public.modules where course_id = v_course and title = 'Module 4 · Real-Life Situations') then
    insert into public.modules (course_id, title, position)
    values (v_course, 'Module 4 · Real-Life Situations', 4) returning id into v_m4;

    insert into public.lessons (module_id, course_id, title, type, content, duration_sec, position) values
    (v_m4, v_course, 'Lesson 1 · At the Café — Ordering Food', 'material', $m4l1$
Let's order like a local in a French café!

KEY PHRASES
• Je voudrais… — I would like… (polite way to order)
• Un café, s'il vous plaît. — A coffee, please.
• L'addition, s'il vous plaît. — The bill, please.
• C'est délicieux ! — It's delicious!
• Combien ça coûte ? — How much does it cost?

FULL DIALOGUE
— Bonjour ! Qu'est-ce que vous prenez ?
— Bonjour ! Je voudrais un café et un croissant, s'il vous plaît.
— Très bien. Autre chose ? (Anything else?)
— Non merci. Combien ça coûte ?
— Cinq euros.
— Voilà. Merci beaucoup !
— Merci à vous. Au revoir !

CULTURE NOTE
Waiters in France will NOT bring the bill until you ask. Say "L'addition, s'il vous plaît" when you're ready to pay.

PRACTICE
1. Order your favourite drink in French.
2. Ask for the bill politely.
    $m4l1$, 480, 1),

    (v_m4, v_course, 'Lesson 2 · Asking for Directions', 'material', $m4l2$
Never get lost in Paris again!

USEFUL QUESTIONS
• Excusez-moi, où est la gare ? — Excuse me, where is the station?
• Pour aller au musée ? — How do I get to the museum?
• C'est loin ? — Is it far?
• C'est près d'ici ? — Is it near here?

ANSWERS YOU'LL HEAR
• Tournez à gauche. — Turn left.
• Tournez à droite. — Turn right.
• Allez tout droit. — Go straight.
• C'est à cinq minutes. — It's five minutes away.
• Prenez la deuxième rue. — Take the second street.

PRACTICE
1. Ask where the school is (l'école).
2. Someone says "Tournez à droite" — what do you do?
    $m4l2$, 420, 2),

    (v_m4, v_course, 'Lesson 3 · Talking About Family', 'material', $m4l3$
Let's introduce the people who matter most — your family!

FAMILY WORDS
• la mère — mother • le père — father
• les parents — parents
• le frère — brother • la sœur — sister
• le fils — son • la fille — daughter
• la femme — wife • le mari — husband
• les grands-parents — grandparents

TALKING ABOUT FAMILY
• J'ai un frère et une sœur. — I have a brother and a sister.
• Je n'ai pas de frère. — I don't have a brother. (note: pas DE)
• Ma mère est professeure. — My mother is a teacher.
• Mon père est ingénieur. — My father is an engineer.

POSSESSIVES
mon/ma/mes = my — choose by the THING's gender, not yours: mon père, ma mère, mes parents.

PRACTICE
1. Write two sentences about your family.
2. Say "I don't have any sisters" in French.
    $m4l3$, 480, 3);
  end if;

  ---------------- PRACTICE QUIZ ----------------
  if not exists (select 1 from public.quizzes where course_id = v_course and title = 'Beginner Check · Modules 1–2') then
    insert into public.quizzes (course_id, title, description, time_limit_min, is_graded)
    values (v_course, 'Beginner Check · Modules 1–2', 'A quick practice quiz on greetings, introductions and polite words. Instant results!', 10, false)
    returning id into v_quiz;

    insert into public.questions (quiz_id, text, type, options, correct_answer, marks, position) values
    (v_quiz, 'How do you say "Hello" (during the day) in French?', 'mcq',
      $j$["Bonjour", "Bonsoir", "Au revoir", "Merci"]$j$::jsonb, 'Bonjour', 1, 1),
    (v_quiz, 'Which phrase means "My name is…"?', 'mcq',
      $j$["Comment ça va ?", "Je m'appelle…", "S'il vous plaît", "Excusez-moi"]$j$::jsonb, 'Je m''appelle…', 1, 2),
    (v_quiz, 'What does "Merci" mean?', 'mcq',
      $j$["Please", "Sorry", "Thank you", "Goodbye"]$j$::jsonb, 'Thank you', 1, 3),
    (v_quiz, 'Which greeting would you use at 9 pm?', 'mcq',
      $j$["Bonjour", "Bonsoir", "Salut", "De rien"]$j$::jsonb, 'Bonsoir', 1, 4),
    (v_quiz, '"Au revoir" means…', 'mcq',
      $j$["See you soon", "Goodbye", "Welcome", "Good night"]$j$::jsonb, 'Goodbye', 1, 5);
  end if;

  raise notice 'Seed complete — course: %', v_course;
end $seed$;
