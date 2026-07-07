(function () {
  "use strict";

  function openEditForm(item, questionData) {
    if (item.querySelector(".scanner-edit-form")) return;

    const textContainer = item.querySelector(".scanner-question-text");
    const answersContainer = item.querySelector(".scanner-answers");

    const form = document.createElement("div");
    form.className = "scanner-edit-form";

    const isFillBlank = questionData.type === "fill_blank" || !questionData.choices || questionData.choices.length === 0;

    let formHTML = "";
    if (isFillBlank) {
      formHTML = `
        <textarea id="edit-qtext-${questionData.index}"></textarea>
        <div class="edit-answers" id="edit-answers-${questionData.index}">
          <div class="edit-answer-row">
            <span class="scanner-edit-ans-label-correct">Đáp án đúng:</span>
            <input type="text" class="ans-text scanner-edit-ans-input-text" />
          </div>
        </div>
        <div class="scanner-edit-actions">
          <button class="scanner-btn scanner-btn-secondary cancel-btn" type="button">Hủy</button>
          <button class="scanner-btn scanner-btn-primary save-btn" type="button">Lưu</button>
        </div>
      `;
    } else {
      formHTML = `
        <textarea id="edit-qtext-${questionData.index}"></textarea>
        <div class="edit-answers" id="edit-answers-${questionData.index}">
          ${questionData.choices.map((c, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isCorrect = (window.houQuizUtils && window.houQuizUtils.normalizeTextForMatching(c) === window.houQuizUtils.normalizeTextForMatching(questionData.answer)) || c === questionData.answer;
            return `
              <div class="edit-answer-row">
                <span class="scanner-edit-ans-letter">${letter}</span>
                <input type="checkbox" class="correct-chk" ${isCorrect ? 'checked' : ''} />
                <input type="text" class="ans-text" />
              </div>
            `;
          }).join("")}
        </div>
        <button class="scanner-btn scanner-btn-secondary scanner-btn-add-row" type="button">+ Thêm đáp án</button>
        <div class="scanner-edit-actions">
          <button class="scanner-btn scanner-btn-secondary cancel-btn" type="button">Hủy</button>
          <button class="scanner-btn scanner-btn-primary save-btn" type="button">Lưu</button>
        </div>
      `;
    }

    form.innerHTML = formHTML;

    // Thiết lập dữ liệu an toàn cho form sau khi chèn vào DOM (Tránh lỗi style/inline và bảo vệ XSS)
    form.querySelector("textarea").value = questionData.question;
    if (isFillBlank) {
      form.querySelector(".ans-text").value = questionData.answer;
    } else {
      const inputs = form.querySelectorAll(".edit-answer-row input[type='text']");
      questionData.choices.forEach((c, idx) => {
        if (inputs[idx]) inputs[idx].value = c;
      });
    }

    if (!isFillBlank) {
      form.querySelector(".scanner-btn-add-row").addEventListener("click", () => {
        const currentRows = form.querySelectorAll(".edit-answer-row").length;
        const nextLetter = String.fromCharCode(65 + currentRows);
        const row = document.createElement("div");
        row.className = "edit-answer-row";
        
        const letterSpan = document.createElement("span");
        letterSpan.className = "scanner-edit-ans-letter";
        letterSpan.textContent = nextLetter;
        
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.className = "correct-chk";
        
        const txt = document.createElement("input");
        txt.type = "text";
        txt.className = "ans-text";
        txt.placeholder = "Nhập đáp án mới";

        row.appendChild(letterSpan);
        row.appendChild(chk);
        row.appendChild(txt);
        form.querySelector(".edit-answers").appendChild(row);
      });
    }

    item.appendChild(form);

    form.querySelector(".cancel-btn").addEventListener("click", () => {
      form.remove();
    });

    form.querySelector(".save-btn").addEventListener("click", () => {
      const newQuestionText = form.querySelector("textarea").value.trim();
      const rows = form.querySelectorAll(".edit-answer-row");
      
      if (isFillBlank) {
        const newAnsVal = form.querySelector(".ans-text").value.trim();
        if (!newAnsVal) {
          window.houQuizScannerUI.showPageToast("Đáp án không được trống", false);
          return;
        }
        questionData.question = newQuestionText;
        questionData.answer = newAnsVal;
        questionData.choices = [];

        textContainer.textContent = newQuestionText;
        
        answersContainer.innerHTML = "";
        const correctItem = document.createElement("div");
        correctItem.className = "scanner-answer-item correct";
        
        const labelSpan = document.createElement("span");
        labelSpan.className = "scanner-ans-label";
        labelSpan.textContent = "Đáp án đúng";
        
        const textSpan = document.createElement("span");
        textSpan.className = "scanner-ans-text";
        textSpan.textContent = newAnsVal;
        
        correctItem.appendChild(labelSpan);
        correctItem.appendChild(textSpan);
        answersContainer.appendChild(correctItem);
      } else {
        const newChoices = [];
        let newAnswer = "";

        rows.forEach(row => {
          const text = row.querySelector(".ans-text").value.trim();
          const isChecked = row.querySelector(".correct-chk").checked;
          if (text) {
            newChoices.push(text);
            if (isChecked) {
              newAnswer = text;
            }
          }
        });

        if (newChoices.length === 0) {
          window.houQuizScannerUI.showPageToast("Lựa chọn không được trống", false);
          return;
        }

        questionData.question = newQuestionText;
        questionData.choices = newChoices;
        if (newAnswer) questionData.answer = newAnswer;

        textContainer.textContent = newQuestionText;
        
        const cleanAns = window.houQuizUtils ? window.houQuizUtils.normalizeTextForMatching(questionData.answer) : questionData.answer;
        
        answersContainer.innerHTML = "";
        newChoices.forEach((c, cIdx) => {
          const letter = String.fromCharCode(65 + cIdx);
          const cleanC = window.houQuizUtils ? window.houQuizUtils.normalizeTextForMatching(c) : c;
          const isCorrect = cleanC === cleanAns || c === questionData.answer;
          
          const choiceItem = document.createElement("div");
          choiceItem.className = `scanner-answer-item ${isCorrect ? 'correct' : ''}`;
          
          const labelSpan = document.createElement("span");
          labelSpan.className = "scanner-ans-label";
          labelSpan.textContent = letter;
          
          const textSpan = document.createElement("span");
          textSpan.className = "scanner-ans-text";
          textSpan.textContent = c;
          
          choiceItem.appendChild(labelSpan);
          choiceItem.appendChild(textSpan);

          if (isCorrect) {
            const checkSpan = document.createElement("span");
            checkSpan.className = "scanner-ans-check";
            checkSpan.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            `;
            choiceItem.appendChild(checkSpan);
          }

          answersContainer.appendChild(choiceItem);
        });
      }

      form.remove();
      window.houQuizScannerUI.showPageToast("Đã lưu sửa đổi câu hỏi!");
    });
  }

  window.houQuizScannerEdit = {
    openEditForm
  };
})();
