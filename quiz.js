// Expects a global `QUIZ` array to be defined before this script runs:
// QUIZ = [{ q: "question text", code: "optional code/data block", options: ["a","b","c","d"], correct: 0, explain: "why" }, ...]

(function(){
  let current = 0;
  let score = 0;
  let answered = [];

  const questionCard = document.getElementById('question-card');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');
  const results = document.getElementById('results');
  const quizBody = document.getElementById('quiz-body');
  const nextBtn = document.getElementById('next-btn');

  function renderQuestion(){
    const item = QUIZ[current];
    progressFill.style.width = ((current) / QUIZ.length * 100) + '%';
    progressLabel.textContent = `Question ${current + 1} of ${QUIZ.length}`;

    let html = `
      <div class="q-num">Station Question ${current + 1}</div>
      <h3>${item.q}</h3>
      ${item.code ? `<pre>${item.code}</pre>` : ''}
      <div class="options" id="options"></div>
      <div class="feedback" id="feedback"></div>
    `;
    questionCard.innerHTML = html;

    const optionsDiv = document.getElementById('options');
    const letters = ['A','B','C','D','E'];
    item.options.forEach((opt, i) => {
      const el = document.createElement('div');
      el.className = 'option';
      el.innerHTML = `<span class="letter">${letters[i]}</span><span>${opt}</span>`;
      el.addEventListener('click', () => selectAnswer(i));
      optionsDiv.appendChild(el);
    });

    nextBtn.disabled = true;
    nextBtn.textContent = current === QUIZ.length - 1 ? 'See results' : 'Next question';
  }

  function selectAnswer(i){
    if(answered[current] !== undefined) return; // already answered
    const item = QUIZ[current];
    answered[current] = i;
    const opts = document.querySelectorAll('.option');
    opts.forEach((el, idx) => {
      el.classList.add('disabled');
      if(idx === item.correct) el.classList.add('correct');
      if(idx === i && i !== item.correct) el.classList.add('incorrect');
      if(idx === i) el.classList.add('selected');
    });

    const feedback = document.getElementById('feedback');
    feedback.classList.add('show');
    if(i === item.correct){
      score++;
      feedback.classList.add('right');
      feedback.textContent = item.explain ? `Correct — ${item.explain}` : 'Correct.';
    } else {
      feedback.classList.add('wrong');
      feedback.textContent = item.explain ? `Not quite — ${item.explain}` : 'Not quite.';
    }
    nextBtn.disabled = false;
  }

  function nextQuestion(){
    if(current === QUIZ.length - 1){
      showResults();
      return;
    }
    current++;
    renderQuestion();
  }

  function showResults(){
    progressFill.style.width = '100%';
    quizBody.style.display = 'none';
    results.classList.add('show');
    const pct = Math.round((score / QUIZ.length) * 100);
    document.getElementById('score-value').textContent = `${score}/${QUIZ.length}`;
    let msg = '';
    if(pct === 100) msg = "Perfect score. You've basically already passed the intro course.";
    else if(pct >= 60) msg = "Solid run — you've got a real feel for this already.";
    else msg = "Now you know exactly what to expect in class. That's the sneak peek.";
    document.getElementById('score-message').textContent = msg;
  }

  nextBtn.addEventListener('click', nextQuestion);
  renderQuestion();
})();
