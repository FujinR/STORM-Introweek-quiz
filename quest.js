// Expects globals defined before this script runs:
// QUEST_META = { character: "Name", goal: "reach the core", verb: "free" }
// STAGES = [{ title, narrative, parts: [ {type:'mcq', q, code?, options, correct, explain}
//                                       | {type:'input', q, code?, accept:[...], numeric?, explain, placeholder?} ] }]

(function(){
  let stageIdx = 0;
  let partIdx = 0;
  let correctCount = 0;
  let totalParts = STAGES.reduce((sum, s) => sum + s.parts.length, 0);
  let stageStarted = false;

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
    stageStarted = true;
  }

  function renderPart(){
    const stage = STAGES[stageIdx];
    const part = stage.parts[partIdx];
    delete partCard.dataset.answered;
    const doneSoFar = STAGES.slice(0, stageIdx).reduce((s, st) => s + st.parts.length, 0) + partIdx;
    progressLabel.textContent = `Checkpoint ${stageIdx + 1} of ${STAGES.length} — step ${partIdx + 1} of ${stage.parts.length}`;
    document.getElementById('progress-fill').style.width = (doneSoFar / totalParts * 100) + '%';

    let html = `<h3>${part.q}</h3>`;
    if(part.code) html += `<pre>${part.code}</pre>`;

    if(part.type === 'mcq'){
      html += `<div class="options" id="options"></div>`;
    } else {
      html += `
        <div class="input-row">
          <input type="text" id="answer-input" class="answer-input" placeholder="${part.placeholder || 'Type your answer'}" autocomplete="off">
          <button class="btn-primary" id="submit-input">Check</button>
        </div>
      `;
    }
    html += `<div class="feedback" id="feedback"></div>`;
    partCard.innerHTML = html;

    if(part.type === 'mcq'){
      const optionsDiv = document.getElementById('options');
      const letters = ['A','B','C','D','E'];
      part.options.forEach((opt, i) => {
        const el = document.createElement('div');
        el.className = 'option';
        el.innerHTML = `<span class="letter">${letters[i]}</span><span>${opt}</span>`;
        el.addEventListener('click', () => selectMcq(i));
        optionsDiv.appendChild(el);
      });
    } else {
      const input = document.getElementById('answer-input');
      const submit = document.getElementById('submit-input');
      submit.addEventListener('click', () => checkInput());
      input.addEventListener('keydown', (e) => { if(e.key === 'Enter') checkInput(); });
    }

    nextBtn.disabled = true;
    const isLastPartOfStage = partIdx === stage.parts.length - 1;
    const isLastStage = stageIdx === STAGES.length - 1;
    nextBtn.textContent = isLastPartOfStage ? (isLastStage ? 'Complete quest' : 'Continue to next checkpoint') : 'Next step';
  }

  function normalize(str){
    return str.toString().trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function selectMcq(i){
    const part = STAGES[stageIdx].parts[partIdx];
    if(partCard.dataset.answered) return;
    partCard.dataset.answered = '1';
    const opts = document.querySelectorAll('.option');
    opts.forEach((el, idx) => {
      el.classList.add('disabled');
      if(idx === part.correct) el.classList.add('correct');
      if(idx === i && i !== part.correct) el.classList.add('incorrect');
      if(idx === i) el.classList.add('selected');
    });
    showFeedback(i === part.correct, part.explain);
  }

  function checkInput(){
    if(partCard.dataset.answered) return;
    const part = STAGES[stageIdx].parts[partIdx];
    const input = document.getElementById('answer-input');
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
    document.getElementById('submit-input').disabled = true;
    input.classList.add(ok ? 'correct-input' : 'incorrect-input');
    showFeedback(ok, part.explain, ok ? null : `Accepted answer: ${part.accept[0]}`);
  }

  function showFeedback(isCorrect, explain, extraNote){
    if(isCorrect) correctCount++;
    const feedback = document.getElementById('feedback');
    feedback.classList.add('show', isCorrect ? 'right' : 'wrong');
    feedback.textContent = (isCorrect ? 'Correct — ' : 'Not quite — ') + (explain || '') + (extraNote ? ` (${extraNote})` : '');
    nextBtn.disabled = false;
  }

  function advance(){
    const stage = STAGES[stageIdx];
    if(partIdx < stage.parts.length - 1){
      partIdx++;
      renderPart();
      return;
    }
    // stage complete
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
