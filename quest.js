// Expects globals defined before this script runs:
// QUEST_META = { character: "Name", goal: "..." }
// STAGES = [{ title, narrative, parts: [
//    {type:'mcq', q, code?, options, correct, explain}
//  | {type:'input', q, code?, accept:[...], numeric?, explain, placeholder?}
//  | {type:'order', q, code?, items:[...in correct order...], explain}
//  | {type:'match', q, pairs:[{left, right}, ...], explain}
// ]}]

(function(){
  let stageIdx = 0;
  let partIdx = 0;
  let correctCount = 0;
  let totalParts = STAGES.reduce((sum, s) => sum + s.parts.length, 0);

  const mapEl = document.getElementById('quest-map');
  const narrativeBox = document.getElementById('stage-narrative');
  const stageTitleEl = document.getElementById('stage-title');
  const partCard = document.getElementById('part-card');
  const nextBtn = document.getElementById('next-btn');
  const quizBody = document.getElementById('quiz-body');
  const results = document.getElementById('results');
  const progressLabel = document.getElementById('progress-label');

  function renderMap(){
    let html = '';
    STAGES.forEach((s, i) => {
      const state = i < stageIdx ? 'done' : (i === stageIdx ? 'active' : 'pending');
      html += `<div class="stage-node ${state}"><span class="node-dot">${i < stageIdx ? '&#10003;' : (i+1)}</span><span class="node-label">${s.title}</span></div>`;
      if(i < STAGES.length - 1){
        html += `<div class="stage-connector ${i < stageIdx ? 'done' : ''}"></div>`;
      }
    });
    mapEl.innerHTML = html;
  }

  function renderStageIntro(){
    const stage = STAGES[stageIdx];
    stageTitleEl.textContent = stage.title;
    narrativeBox.innerHTML = `<p>${stage.narrative}</p>`;
    narrativeBox.classList.add('show');
  }

  function shuffled(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function setProgress(){
    const stage = STAGES[stageIdx];
    const doneSoFar = STAGES.slice(0, stageIdx).reduce((s, st) => s + st.parts.length, 0) + partIdx;
    progressLabel.textContent = `Checkpoint ${stageIdx + 1} of ${STAGES.length} — step ${partIdx + 1} of ${stage.parts.length}`;
    document.getElementById('progress-fill').style.width = (doneSoFar / totalParts * 100) + '%';
  }

  function setNextLabel(){
    const stage = STAGES[stageIdx];
    const isLastPartOfStage = partIdx === stage.parts.length - 1;
    const isLastStage = stageIdx === STAGES.length - 1;
    nextBtn.disabled = true;
    nextBtn.textContent = isLastPartOfStage ? (isLastStage ? 'Complete quest' : 'Continue to next checkpoint') : 'Next step';
  }

  function renderPart(){
    const stage = STAGES[stageIdx];
    const part = stage.parts[partIdx];
    delete partCard.dataset.answered;
    setProgress();
    setNextLabel();

    let headHtml = `<h3>${part.q}</h3>`;
    if(part.code) headHtml += `<pre>${part.code}</pre>`;
    partCard.innerHTML = headHtml + `<div id="part-body"></div><div class="feedback" id="feedback"></div>`;
    const body = document.getElementById('part-body');

    if(part.type === 'mcq') renderMcq(part, body);
    else if(part.type === 'input') renderInput(part, body);
    else if(part.type === 'order') renderOrder(part, body);
    else if(part.type === 'match') renderMatch(part, body);
  }

  function normalize(str){
    return str.toString().trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function showFeedback(isCorrect, explain, extraNote, allowNext){
    if(allowNext === undefined) allowNext = true;
    if(isCorrect) correctCount++;
    const feedback = document.getElementById('feedback');
    feedback.classList.add('show', isCorrect ? 'right' : 'wrong');
    feedback.textContent = (isCorrect ? 'Correct — ' : 'Not quite — ') + (explain || '') + (extraNote ? ` (${extraNote})` : '');
    if(allowNext) nextBtn.disabled = false;
  }

  /* ---------- MCQ ---------- */
  function renderMcq(part, body){
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'options';
    const letters = ['A','B','C','D','E'];
    part.options.forEach((opt, i) => {
      const el = document.createElement('div');
      el.className = 'option';
      el.innerHTML = `<span class="letter">${letters[i]}</span><span>${opt}</span>`;
      el.addEventListener('click', () => {
        if(partCard.dataset.answered) return;
        partCard.dataset.answered = '1';
        const opts = optionsDiv.querySelectorAll('.option');
        opts.forEach((o, idx) => {
          o.classList.add('disabled');
          if(idx === part.correct) o.classList.add('correct');
          if(idx === i && i !== part.correct) o.classList.add('incorrect');
          if(idx === i) o.classList.add('selected');
        });
        showFeedback(i === part.correct, part.explain);
      });
      optionsDiv.appendChild(el);
    });
    body.appendChild(optionsDiv);
  }

  /* ---------- INPUT (typed answer, kept for flexibility) ---------- */
  function renderInput(part, body){
    body.innerHTML = `
      <div class="input-row">
        <input type="text" id="answer-input" class="answer-input" placeholder="${part.placeholder || 'Type your answer'}" autocomplete="off">
        <button type="button" class="btn-primary" id="submit-input">Check</button>
      </div>
    `;
    const input = document.getElementById('answer-input');
    const submit = document.getElementById('submit-input');
    function check(){
      if(partCard.dataset.answered) return;
      const val = normalize(input.value);
      let ok;
      if(part.numeric){
        const num = parseFloat(val.replace(/,/g, '.'));
        ok = part.accept.some(a => Math.abs(parseFloat(a) - num) < 0.01);
      } else {
        ok = part.accept.some(a => normalize(a) === val);
      }
      partCard.dataset.answered = '1';
      input.disabled = true;
      submit.disabled = true;
      input.classList.add(ok ? 'correct-input' : 'incorrect-input');
      showFeedback(ok, part.explain, ok ? null : `Accepted answer: ${part.accept[0]}`);
    }
    submit.addEventListener('click', check);
    input.addEventListener('keydown', (e) => { if(e.key === 'Enter') check(); });
  }

  /* ---------- ORDER (tap items into the correct sequence) ---------- */
  function renderOrder(part, body){
    const pool = shuffled(part.items.map((text, idx) => ({ text, idx })));
    let selected = [];
    let locked = false;

    body.innerHTML = `
      <div class="order-pool" id="order-pool"></div>
      <div class="order-selected-label">Your order (tap to remove)</div>
      <div class="order-selected" id="order-selected"></div>
      <div class="order-actions">
        <button type="button" class="btn-ghost" id="order-reset">Reset</button>
        <button type="button" class="btn-primary" id="order-check" disabled>Check order</button>
      </div>
    `;
    const poolEl = document.getElementById('order-pool');
    const selEl = document.getElementById('order-selected');
    const checkBtn = document.getElementById('order-check');
    const resetBtn = document.getElementById('order-reset');

    function draw(){
      poolEl.innerHTML = '';
      pool.forEach(item => {
        if(selected.includes(item.idx)) return;
        const el = document.createElement('div');
        el.className = 'order-item';
        el.textContent = item.text;
        if(!locked) el.addEventListener('click', () => { selected.push(item.idx); draw(); });
        poolEl.appendChild(el);
      });

      selEl.innerHTML = '';
      selected.forEach((idx, pos) => {
        const el = document.createElement('div');
        el.className = 'order-item selected-chip';
        el.innerHTML = `<span class="order-badge">${pos + 1}</span><span>${part.items[idx]}</span>`;
        if(!locked) el.addEventListener('click', () => { selected.splice(pos, 1); draw(); });
        selEl.appendChild(el);
      });

      checkBtn.disabled = locked || selected.length !== part.items.length;
      resetBtn.disabled = locked;
    }

    checkBtn.addEventListener('click', () => {
      const isCorrect = selected.every((idx, pos) => idx === pos);
      if(isCorrect){
        locked = true;
        partCard.dataset.answered = '1';
        draw();
        showFeedback(true, part.explain, null, true);
      } else {
        showFeedback(false, part.explain, 'rearrange it and check again', false);
      }
    });

    resetBtn.addEventListener('click', () => { selected = []; draw(); });

    draw();
  }

  /* ---------- MATCH (tap a left item, then its matching right item) ---------- */
  function renderMatch(part, body){
    const left = part.pairs.map((p, i) => ({ text: p.left, pairIdx: i }));
    const right = shuffled(part.pairs.map((p, i) => ({ text: p.right, pairIdx: i })));
    let selectedLeft = null;
    let matched = new Set();

    body.innerHTML = `
      <div class="match-columns">
        <div class="match-col" id="match-left"></div>
        <div class="match-col" id="match-right"></div>
      </div>
      <div class="match-progress" id="match-progress"></div>
    `;
    const leftEl = document.getElementById('match-left');
    const rightEl = document.getElementById('match-right');
    const progressEl = document.getElementById('match-progress');

    function updateProgress(){
      progressEl.textContent = `Matched ${matched.size} of ${part.pairs.length}`;
    }

    function draw(){
      leftEl.innerHTML = '';
      left.forEach(item => {
        const el = document.createElement('div');
        el.className = 'match-item';
        if(matched.has(item.pairIdx)) el.classList.add('matched');
        if(selectedLeft === item.pairIdx) el.classList.add('selected');
        el.textContent = item.text;
        if(!matched.has(item.pairIdx)){
          el.addEventListener('click', () => {
            selectedLeft = (selectedLeft === item.pairIdx) ? null : item.pairIdx;
            draw();
          });
        }
        leftEl.appendChild(el);
      });

      rightEl.innerHTML = '';
      right.forEach(item => {
        const el = document.createElement('div');
        el.className = 'match-item';
        if(matched.has(item.pairIdx)) el.classList.add('matched');
        el.textContent = item.text;
        if(!matched.has(item.pairIdx)){
          el.addEventListener('click', () => {
            if(selectedLeft === null) return;
            if(selectedLeft === item.pairIdx){
              matched.add(item.pairIdx);
              selectedLeft = null;
              draw();
              updateProgress();
              if(matched.size === part.pairs.length){
                partCard.dataset.answered = '1';
                showFeedback(true, part.explain, null, true);
              }
            } else {
              el.classList.add('incorrect');
              const leftMatch = leftEl.querySelector('.selected');
              if(leftMatch) leftMatch.classList.add('incorrect');
              setTimeout(() => { selectedLeft = null; draw(); }, 550);
            }
          });
        }
        rightEl.appendChild(el);
      });
    }

    draw();
    updateProgress();
  }

  function advance(){
    const stage = STAGES[stageIdx];
    if(partIdx < stage.parts.length - 1){
      partIdx++;
      renderPart();
      return;
    }
    if(stageIdx < STAGES.length - 1){
      stageIdx++;
      partIdx = 0;
      renderMap();
      renderStageIntro();
      renderPart();
    } else {
      finish();
    }
  }

  function finish(){
    renderMap();
    document.getElementById('progress-fill').style.width = '100%';
    quizBody.style.display = 'none';
    results.classList.add('show');
    document.getElementById('score-value').textContent = `${correctCount}/${totalParts}`;
    const pct = Math.round((correctCount / totalParts) * 100);
    let msg;
    if(pct === 100) msg = `Flawless run — every checkpoint cleared. ${QUEST_META.character} made it, no wrong turns.`;
    else if(pct >= 60) msg = `${QUEST_META.character} made it through. A few stumbles along the way, but you got there.`;
    else msg = `${QUEST_META.character} made it to the end — this is exactly the kind of thinking you'll be doing all semester.`;
    document.getElementById('score-message').textContent = msg;
  }

  nextBtn.addEventListener('click', advance);

  renderMap();
  renderStageIntro();
  renderPart();
})();
