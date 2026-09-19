# Using The Storm Breaks in class

## One lesson (40–50 minutes)

1. **Briefing (10 min).** Students read the start-screen briefing (Versailles → Depression → appeasement → Nazi–Soviet Pact). Ask: *which nation would you least like to lead right now, and why?*
2. **Play (25 min).** Each student or pair chooses a nation. Use **Historical** mode so unrealistic orders fail with an explanation. Students should aim for 4–6 turns and answer each turn's reflection question in the lesson drawer.
3. **Debrief (10 min).** Compare outcomes across the room. Useful questions:
   - Whose order failed, and what historical factor made it impossible?
   - Did anyone avoid war? What did it cost?
   - Which was more powerful in your run: your decisions, or geography and economics?

Students then click **Journal → Download journal**. The Markdown file contains every order, outcome, real-history comparison and their own reflections.

At the end of the lesson (or when a group wants to stop), click **Finish Game**. The after-action report grades historical realism, strategy, economics, diplomacy and decision quality, names the most important decisions, and compares the timeline with real history. Download it as Markdown or JSON for assessment.

## Running the China campaign

**China's War of Resistance** starts in September 1939 with the Second Sino-Japanese War already two years old. Students can play the Nationalists (Chiang Kai-shek), the Communists (Mao Zedong) or Japan. The CCP owns its northwestern base area around Yan'an, while its other base areas appear as occupation stripes inside Nationalist territory — a good prompt for discussing the uneasy Second United Front. The **China** map view zooms to the theatre. The same lesson flow and report work as in the WWII campaign.

## Assessment ideas

- **Exit ticket:** one decision you made, one unintended consequence, one question you still have.
- **Essay using game evidence:** "Could your nation have avoided war in 1939–40? Use two decisions from your journal and two real events from the lessons."
- **Compare with reality:** "Which of your turns was closest to what really happened? Why do you think the real leader chose differently?"
- **Grade reasoning, not winning.** A student whose nation collapses but can explain why has shown strong historical understanding.

## HKDSE History links

The lessons end with an "exam skill" tip, and the start date sits inside the Conflicts and Cooperation theme (causes and course of the Second World War). Hong Kong's occupation (December 1941–August 1945) is in the real-events list.

- **Paper 1 (data-based):** after a session, ask students to treat their own journal entries as sources. How reliable is the in-game narrative compared with the "what really happened" section? Why?
- **Paper 2 (essay):** run the game before an essay on the causes of the war. Students plan paragraphs around long-term causes (early-game constraints), short-term triggers (their key turns) and a counter-argument (how AI rivals reacted).

## Things to tell students

- The AI can be wrong. The "what really happened" sections are anchored to a checked list of real events, but the story of *their* timeline is fiction.
- Leader dialogue is invented in-game speech, not real quotations.
- The game will not let players commit atrocities. If asked, it explains the real history instead.

If ElevenLabs is configured, the headline and short summary play automatically after each order. The full narrative is not spoken. Students can change how fast it is read with the **Speed** slider in the top bar (0.5×–2×, default 1.5×). **Narration off** (or the **L** key) stops the requests.

## Setup options

- **Each student's computer:** install Node.js, then `npm install` and `npm start` (see README). Add an API key to `.env`, or use offline demo mode.
- **Teacher demo:** run it on the projector and let the class vote on each order.
- **Cost:** a turn uses three short AI calls. With DeepSeek this is typically a small fraction of a US cent per turn; check current pricing on the provider's site.
