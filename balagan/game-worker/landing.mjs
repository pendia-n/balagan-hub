const rules = {
  wemember: {
    title: 'Hear it once. Remember what you can.',
    intro: 'A private voice-memory game. One person reads a short script. Everyone else gets a single listen, then types the details they remember.',
    action: ['Host a voice challenge', '/challenge/new'],
    sample: ['From a host’s script', 'At eight, Mina took a brass key, put on a red hat, and boarded the train to the seaside.'],
    steps: [
      ['Record and invite', 'The host gets a script, reads it aloud or uploads an MP3, and shares a private room link. Hosting is free.'],
      ['Listen once and type', 'Players join with Balagan and hear the clip once. Playback must finish before they can submit. They get one answer.'],
      ['Find out what stuck', 'The app scores the correct details. If two players get the same score, the faster submission after playback wins. Voice and intonation aren’t scored.'],
    ],
    entry: 'First challenge each UTC day is free. Additional challenges cost 15 tokens each.',
    rewards: 'Players who recall at least one correct detail can win 15 tokens for first place, 8 for second or 5 for third.',
  },
  sorriest: {
    title: 'The cake is gone. Explain yourself.',
    intro: 'Write a public apology for a fictional scandal. When submissions close, the other contestants decide who handled it best.',
    action: ['Browse today’s contests', '/daily'],
    sample: ['A scandal you might get', 'The last slice of birthday cake disappeared before the toast. You were the host. What do you say to the room?'],
    steps: [
      ['Find an open contest', 'Nineteen contests open across each UTC day. Anyone can browse. Sign in and enter to take part.'],
      ['Write one apology', 'You have 24 hours from the contest opening to submit up to 500 characters. Once submitted, the apology is locked.'],
      ['Vote on the field', 'Voting lasts another 24 hours. Entrants can vote once and can’t vote for themselves. The results appear after voting closes.'],
    ],
    entry: 'Browsing is free. Entering costs 20 tokens per contest.',
    rewards: 'Only apologies with votes qualify. Places 1–3 earn 20 tokens each, 4–7 earn 10 each, 8–9 earn 8 each, and 10th earns 5. Ties use a random order assigned before voting.',
  },
  barara: {
    title: 'Put the missing cookie on trial.',
    intro: 'A private courtroom game for petty fictional disputes. Argue both sides, then let your friends deliver the verdict.',
    action: ['Open a private court', '/challenge/new'],
    sample: ['A case you might hear', 'The accused was seen near an empty plate. There is a trail of crumbs. How do they explain it?'],
    steps: [
      ['Pick a case and invite friends', 'The host chooses a case and shares the room link. The first person to join is the opponent. Up to five more can sit on the jury.'],
      ['Make your case', 'The two sides trade up to seven short arguments each. The argument phase lasts up to eight minutes and can end early.'],
      ['Let the jury decide', 'Jurors cast one private ballot in the two-minute voting phase. The verdict is revealed when voting finishes.'],
    ],
    entry: 'Opening a lobby is free. To play, the host, opponent and each juror pay 30 tokens for their seat.',
    rewards: 'The winner earns 20 tokens. Each juror who voted for the winner earns 15. Payouts require at least three ballots and a winning side.',
  },
};

export const landingCSS = `
.game-intro{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);align-items:stretch;gap:clamp(20px,5vw,64px);padding:0 0 clamp(26px,5vw,56px)}
.game-intro h1{font-family:Georgia,serif;font-weight:700;font-size:clamp(2.65rem,7vw,5.3rem);margin:0 0 .26em}
.game-intro p{max-width:42ch}
.game-intro figure{margin:0;border:1px solid currentColor;align-self:start;background:#ffffff68}
.game-intro img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}
.game-intro figcaption{padding:16px 19px;font-size:.94rem}
.game-intro figcaption p{margin:.32em 0 0}
.practice{border:1px solid currentColor;border-top:5px solid currentColor;padding:clamp(18px,4vw,34px);margin-bottom:28px;background:#ffffff80}
.practice h2{margin-top:0}
.round-progress{display:flex;flex-wrap:wrap;gap:7px;padding:0;margin:0 0 22px;list-style:none}
.round-progress li{padding:5px 10px;border:1px solid currentColor;border-radius:4px;font-size:.9rem}
.round-progress [aria-current]{font-weight:800}
.round-progress [aria-current]{background:#fff;box-shadow:0 3px 0 currentColor}
.practice fieldset{border:0;padding:0;margin:0}
.practice textarea,.practice input{max-width:600px}
.game-guide{border-top:1px solid currentColor;padding:26px 0 12px;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:clamp(18px,5vw,52px)}
.game-guide h2{margin:0 0 18px}
.game-guide ol{padding-left:24px;margin:0}
.game-guide li+li{margin-top:14px}
.game-guide aside{border-top:4px solid currentColor;background:#ffffff80;padding:20px 22px;align-self:start}
.game-guide aside p{margin:.2em 0 1em}
.game-guide h3{margin:0}
nav>div{display:flex;align-items:center;gap:12px;flex-wrap:wrap}fieldset{min-width:0}
@media(max-width:720px){.game-intro,.game-guide{grid-template-columns:minmax(0,1fr)}}
@media(max-width:440px){nav{flex-wrap:wrap;gap:4px 16px;padding:12px 0}nav>div a{min-height:40px;display:inline-flex;align-items:center}main{padding-top:24px}}
`;

function practice(game, sample) {
  if(game==='barara')return `
    <section class="practice" id="practice" aria-labelledby="practice-title">
      <h2 id="practice-title">Give a practice verdict</h2>
      <p><strong>Host:</strong> The plate was empty. There were crumbs on their sleeve.</p>
      <p><strong>Opponent:</strong> I carried the plate from the kitchen. The crumbs were already there.</p>
      <button type="button" data-verdict="host">Side with the host</button>
      <button type="button" data-verdict="opponent">Side with the opponent</button>
      <p id="practice-result" role="status"></p>
    </section>
    <script>
      for(const button of document.querySelectorAll("[data-verdict]")){
        button.onclick=()=>{
          document.getElementById("practice-result").textContent="Practice verdict: "+(button.dataset.verdict==="host"?"the host wins.":"the opponent wins.")+" In a real room, the jury votes in private.";
        };
      }
    </script>`;
  if(game==='sorriest')return `
    <section class="practice" id="practice" aria-labelledby="practice-title">
      <h2 id="practice-title">Try an apology</h2><p>${sample[1]}</p>
      <label for="practice-reply">Your practice apology</label>
      <textarea id="practice-reply" maxlength="500"></textarea>
      <button type="button" id="practice-preview">Preview apology</button>
      <p id="practice-result" role="status" class="answer"></p>
    </section>
    <script>
      document.getElementById("practice-preview").onclick=()=>{
        const draft=document.getElementById("practice-reply").value.trim();
        document.getElementById("practice-result").textContent=draft || "Write a few words first.";
      };
    </script>`;
  return `
    <section class="practice" id="practice" aria-labelledby="practice-title">
      <h2 id="practice-title">Try one listen</h2>
      <p>Listen for the name, the object and the destination.</p>
      <button type="button" id="practice-listen">Play practice clip</button>
      <fieldset id="practice-fields" disabled>
        <label for="practice-reply">What do you remember?</label>
        <input id="practice-reply">
        <button type="button" id="practice-score">Check recall</button>
      </fieldset>
      <p id="practice-result" role="status"></p>
    </section>
    <script>
      const listen = document.getElementById("practice-listen");
      const result = document.getElementById("practice-result");
      listen.onclick=async()=>{
        listen.disabled=true;
        const clip=new Audio("https://balagan.live/wemember-practice.mp3");
        clip.onended=()=>{
          document.getElementById("practice-fields").disabled=false;
          result.textContent="Type the details you remember.";
          document.getElementById("practice-reply").focus();
        };
        try {
          await clip.play();
          result.textContent="Listen for three details.";
        } catch {
          listen.disabled=false;
          result.textContent="Could not play the clip. Try again.";
        }
      };
      document.getElementById("practice-score").onclick=()=>{
        const answer=document.getElementById("practice-reply").value.toLowerCase();
        const score=["lena","yellow umbrella","library"].filter(x=>answer.includes(x)).length;
        result.textContent=score+" out of 3 details. Lena took a yellow umbrella to the library.";
        document.getElementById("practice-fields").disabled=true;
      };
    </script>`;
}

export function gameLanding(game) {
  const {title,intro,action,sample,steps,entry,rewards}=rules[game];
  return `
    <section class="game-intro">
      <div>
        <h1>${title}</h1>
        <p>${intro}</p>
        <a class="button" href="${action[1]}">${action[0]}</a>
        <a href="#practice">Try it free</a> · <a href="#how-to-play">How to play</a>
      </div>
      <figure>
        <img src="https://balagan.live/media/${game}-wide.png" alt="" width="1672" height="941">
        <figcaption><strong>${sample[0]}</strong><p>${sample[1]}</p></figcaption>
      </figure>
    </section>
    ${practice(game,sample)}
    <div class="game-guide" id="how-to-play">
      <section>
        <h2>How to play</h2>
        <ol>${steps.map(([label,copy])=>`<li><strong>${label}</strong><br>${copy}</li>`).join('')}</ol>
      </section>
      <aside>
        <h2>Balagan tokens</h2>
        <h3>Entry</h3><p>${entry}</p>
        <h3>Rewards</h3><p>${rewards} Rewards go into your Balagan wallet.</p>
        <a href="https://balagan.live/wallet">Open Balagan wallet</a>
      </aside>
    </div>`;
}
