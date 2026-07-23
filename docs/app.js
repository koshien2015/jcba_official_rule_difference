/**
 * キャップ野球 規則クイズ
 * 依存ライブラリなし。questions.json を読み込んで出題する。
 */
;(function () {
  'use strict'

  var HISTORY_KEY = 'cap-rule-quiz/history/v1'
  var PASS_RATE = 0.9
  var TF_CHOICES = ['正しい', '誤り']
  var CATEGORY_LABELS = { knowledge: '規則の知識', judgement: '場面判定' }

  var el = function (id) {
    return document.getElementById(id)
  }

  /** @type {{questions: Array, meta: Object}} */
  var data = { questions: [], meta: {} }

  /** 出題中のセッション。更新時は必ず新しいオブジェクトを作る。 */
  var session = null

  // ---------------------------------------------------------------- 履歴

  function loadHistory() {
    try {
      var raw = window.localStorage.getItem(HISTORY_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch (error) {
      // localStorage が使えない環境（プライベートモード等）では履歴なしとして続行する
      return {}
    }
  }

  function saveHistory(history) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch (error) {
      // 保存できなくてもクイズの進行は妨げない
    }
  }

  function recordResult(questionId, isCorrect) {
    var history = loadHistory()
    var current = history[questionId] || { right: 0, wrong: 0 }
    var updated = Object.assign({}, history)
    updated[questionId] = {
      right: current.right + (isCorrect ? 1 : 0),
      wrong: current.wrong + (isCorrect ? 0 : 1),
    }
    saveHistory(updated)
  }

  /** 間違えた回数が正解回数を上回っている問題を「苦手」とみなす */
  function isWeak(questionId, history) {
    var stat = history[questionId]
    return Boolean(stat) && stat.wrong > stat.right
  }

  // ---------------------------------------------------------------- 出題順

  function shuffle(items) {
    var result = items.slice()
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1))
      var tmp = result[i]
      result[i] = result[j]
      result[j] = tmp
    }
    return result
  }

  function buildQueue(options) {
    var pool = data.questions.filter(function (question) {
      var matchesChapter = options.chapter === '' || question.chapter === options.chapter
      var matchesCategory = options.category === '' || question.category === options.category
      return matchesChapter && matchesCategory
    })

    var ordered = shuffle(pool)

    if (options.weakFirst) {
      var history = loadHistory()
      var weak = ordered.filter(function (question) {
        return isWeak(question.id, history)
      })
      var rest = ordered.filter(function (question) {
        return !isWeak(question.id, history)
      })
      ordered = weak.concat(rest)
    }

    return options.count > 0 ? ordered.slice(0, options.count) : ordered
  }

  function choicesOf(question) {
    return question.type === 'tf' ? TF_CHOICES : question.choices
  }

  function correctIndexOf(question) {
    return question.type === 'tf' ? (question.answer === true ? 0 : 1) : question.answer
  }

  // ---------------------------------------------------------------- 画面遷移

  function showScreen(name) {
    var screens = ['start', 'quiz', 'result', 'error']
    screens.forEach(function (screen) {
      el('screen-' + screen).classList.toggle('is-hidden', screen !== name)
    })
    window.scrollTo(0, 0)
  }

  // ---------------------------------------------------------------- 出題

  function startSession(questions) {
    if (questions.length === 0) {
      window.alert('この条件に一致する問題がありません。')
      return
    }
    session = { queue: questions, index: 0, correctCount: 0, wrongQuestions: [] }
    showScreen('quiz')
    renderQuestion()
  }

  function renderQuestion() {
    var question = session.queue[session.index]
    var total = session.queue.length

    el('progress-label').textContent = '第' + (session.index + 1) + '問 / 全' + total + '問'
    el('progress-score').textContent = '正解 ' + session.correctCount
    el('progress-fill').style.width = (session.index / total) * 100 + '%'

    el('question-chapter').textContent =
      '［' + CATEGORY_LABELS[question.category] + '］' + question.chapter + '　' + question.ref
    el('question-text').textContent = question.question

    var container = el('choices')
    container.textContent = ''
    choicesOf(question).forEach(function (label, index) {
      container.appendChild(createChoiceButton(label, index))
    })

    el('feedback').classList.add('is-hidden')
  }

  function createChoiceButton(label, index) {
    var button = document.createElement('button')
    button.type = 'button'
    button.className = 'choice'
    button.dataset.index = String(index)

    var mark = document.createElement('span')
    mark.className = 'choice__mark'
    mark.textContent = String(index + 1)

    var text = document.createElement('span')
    text.textContent = label

    button.appendChild(mark)
    button.appendChild(text)
    button.addEventListener('click', function () {
      handleAnswer(index)
    })
    return button
  }

  function handleAnswer(selectedIndex) {
    var question = session.queue[session.index]
    var correctIndex = correctIndexOf(question)
    var isCorrect = selectedIndex === correctIndex

    var buttons = el('choices').querySelectorAll('.choice')
    Array.prototype.forEach.call(buttons, function (button, index) {
      button.disabled = true
      if (index === correctIndex) {
        button.classList.add('is-correct')
        button.querySelector('.choice__mark').textContent = '○'
      } else if (index === selectedIndex) {
        button.classList.add('is-wrong')
        button.querySelector('.choice__mark').textContent = '×'
      }
    })

    session = {
      queue: session.queue,
      index: session.index,
      correctCount: session.correctCount + (isCorrect ? 1 : 0),
      wrongQuestions: isCorrect ? session.wrongQuestions : session.wrongQuestions.concat([question]),
    }

    recordResult(question.id, isCorrect)
    renderFeedback(question, isCorrect)
    el('progress-score').textContent = '正解 ' + session.correctCount
  }

  function renderFeedback(question, isCorrect) {
    var verdict = el('feedback-verdict')
    verdict.textContent = isCorrect ? '正解' : '不正解'
    verdict.className = 'feedback__verdict ' + (isCorrect ? 'is-correct' : 'is-wrong')

    el('feedback-explanation').textContent = question.explanation
    el('feedback-quote').textContent = question.quote
    el('feedback-ref').textContent = question.chapter + '　' + question.ref
    el('btn-next').textContent =
      session.index === session.queue.length - 1 ? '結果を見る' : '次の問題へ'
    el('feedback').classList.remove('is-hidden')
    el('feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function goNext() {
    if (session.index === session.queue.length - 1) {
      renderResult()
      return
    }
    session = Object.assign({}, session, { index: session.index + 1 })
    renderQuestion()
  }

  // ---------------------------------------------------------------- 結果

  function renderResult() {
    var total = session.queue.length
    var rate = session.correctCount / total
    var passed = rate >= PASS_RATE

    var badge = el('result-badge')
    badge.textContent = passed ? '合格' : '不合格'
    badge.className = 'result__badge ' + (passed ? 'is-pass' : 'is-fail')

    el('result-score').textContent = session.correctCount + ' / ' + total
    el('result-rate').textContent =
      '正答率 ' + Math.round(rate * 100) + '%（合格ライン ' + PASS_RATE * 100 + '%）'

    var list = el('result-review')
    list.textContent = ''
    session.wrongQuestions.forEach(function (question) {
      list.appendChild(createReviewItem(question))
    })

    el('result-review-wrap').classList.toggle('is-hidden', session.wrongQuestions.length === 0)
    el('btn-retry-wrong').classList.toggle('is-hidden', session.wrongQuestions.length === 0)

    showScreen('result')
  }

  function createReviewItem(question) {
    var item = document.createElement('li')
    var chapter = document.createElement('span')
    chapter.className = 'review__chapter'
    chapter.textContent = question.chapter + '　' + question.ref
    item.appendChild(chapter)
    item.appendChild(document.createTextNode(question.question))
    return item
  }

  // ---------------------------------------------------------------- 初期化

  function populateChapters() {
    var select = el('select-chapter')
    var chapters = []
    data.questions.forEach(function (question) {
      if (chapters.indexOf(question.chapter) === -1) {
        chapters.push(question.chapter)
      }
    })

    select.appendChild(new Option('すべての章（' + data.questions.length + '問）', ''))
    chapters.forEach(function (chapter) {
      var count = data.questions.filter(function (question) {
        return question.chapter === chapter
      }).length
      select.appendChild(new Option(chapter + '（' + count + '問）', chapter))
    })
  }

  function bindEvents() {
    el('btn-start').addEventListener('click', function () {
      startSession(
        buildQueue({
          category: el('select-category').value,
          chapter: el('select-chapter').value,
          count: Number(el('select-count').value),
          weakFirst: el('check-weak').checked,
        })
      )
    })

    el('btn-next').addEventListener('click', goNext)

    el('btn-quit').addEventListener('click', function () {
      showScreen('start')
    })

    el('btn-back').addEventListener('click', function () {
      showScreen('start')
    })

    el('btn-retry-wrong').addEventListener('click', function () {
      startSession(shuffle(session.wrongQuestions))
    })

    el('btn-reset-history').addEventListener('click', function () {
      if (window.confirm('学習履歴を削除します。よろしいですか？')) {
        saveHistory({})
        renderStartInfo()
      }
    })
  }

  function renderStartInfo() {
    var history = loadHistory()
    var weakCount = data.questions.filter(function (question) {
      return isWeak(question.id, history)
    }).length

    var countOf = function (category) {
      return data.questions.filter(function (question) {
        return question.category === category
      }).length
    }

    el('start-info').textContent =
      '全' +
      data.questions.length +
      '問（規則の知識 ' +
      countOf('knowledge') +
      '問 / 場面判定 ' +
      countOf('judgement') +
      '問）' +
      (weakCount > 0 ? ' / 苦手 ' + weakCount + '問' : '')

    if (data.meta.sourceUrl) {
      el('link-source').href = data.meta.sourceUrl
    }
  }

  function showError(message) {
    el('error-message').textContent = message
    showScreen('error')
  }

  function init() {
    fetch('./questions.json', { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status)
        }
        return response.json()
      })
      .then(function (json) {
        data = json
        populateChapters()
        renderStartInfo()
        bindEvents()
        el('screen-start').classList.remove('is-hidden')
      })
      .catch(function (error) {
        showError(
          'questions.json の読み込みに失敗しました（' +
            error.message +
            '）。ローカルで確認する場合は file:// ではなく HTTP サーバー経由で開いてください。'
        )
      })
  }

  document.addEventListener('DOMContentLoaded', init)
})()
