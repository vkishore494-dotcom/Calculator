const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const buttons = document.querySelectorAll(".btn");
const themeToggle = document.getElementById("theme-toggle");
const copyButton = document.getElementById("copy-button");
const historyToggle = document.getElementById("history-toggle");
const historyContent = document.getElementById("history-content");
const historyList = document.getElementById("history-list");
const historyCount = document.getElementById("history-count");
const clearHistoryButton = document.getElementById("clear-history");
const toast = document.getElementById("toast");

const STORAGE_KEYS = {
  theme: "calculatorTheme",
  history: "calculatorHistory",
};

const operatorSymbols = ["+", "-", "*", "/"];
let expression = "";
let lastResult = "0";
let history = [];
let toastTimer = null;

/**
 * Safe theme application when the page loads or the user toggles.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.innerHTML =
  theme==="light" ? "🌙 Dark" : "☀️ Light";
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function loadTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
  applyTheme(savedTheme === "light" ? "light" : "dark");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
}

function isOperator(value) {
  return operatorSymbols.includes(value);
}

function getLastCharacter() {
  return expression.slice(-1);
}

function getCurrentNumber() {
  const matched = expression.match(/(?:^|[+\-*/])([0-9]*\.?[0-9]*)$/);
  return matched ? matched[1] : "";
}

function canAppendOperator(value) {
  const lastChar = getLastCharacter();
  if (!expression && value !== "-") {
    return false;
  }

  if (isOperator(lastChar) || lastChar === "(") {
    return false;
  }

  return true;
}

function canAppendDot() {
  const lastChar = getLastCharacter();
  const currentNumber = getCurrentNumber();

  if (!expression || isOperator(lastChar) || lastChar === "(") {
    return true;
  }

  return !currentNumber.includes(".");
}

function sanitizeExpression(value) {
  return value.replace(/[^0-9.+\-*/()]/g, "");
}

function trimPreviewExpression(value) {
  let trimmed = value;
  while (trimmed && (isOperator(trimmed.slice(-1)) || trimmed.slice(-1) === "(")) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

function formatResult(value) {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const rounded = Math.round(value * 10000) / 10000;
  const [integerPart, decimalPart = ""] = String(rounded).split(".");
  const formattedInteger = Number(integerPart).toLocaleString("en-US");
  const trimmedDecimal = decimalPart.replace(/0+$/, "");

  return trimmedDecimal ? `${formattedInteger}.${trimmedDecimal}` : formattedInteger;
}

function createRipple(target, event) {
  const ripple = document.createElement("span");
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  ripple.className = "ripple-effect";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x - size / 2}px`;
  ripple.style.top = `${y - size / 2}px`;
  target.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, 600);
}

function animateResult() {
  resultEl.classList.add("pulse");
  setTimeout(() => {
    resultEl.classList.remove("pulse");
  }, 180);
}

function showError(message) {
  resultEl.textContent = message;
  resultEl.classList.add("error");
}

function clearError() {
  resultEl.classList.remove("error");
}

function evaluateExpression(input) {
  const tokens = input.match(/\d+(?:\.\d+)?|[()+\-*/]/g) || [];
  if (!tokens.length) {
    throw new Error("invalid");
  }

  const values = [];
  const operators = [];
  const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };

  const applyOperator = () => {
    if (values.length < 2 || !operators.length) {
      throw new Error("invalid");
    }

    const b = values.pop();
    const a = values.pop();
    const operator = operators.pop();

    if (operator === "+") values.push(a + b);
    if (operator === "-") values.push(a - b);
    if (operator === "*") values.push(a * b);
    if (operator === "/") {
      if (b === 0) {
        throw new Error("divideByZero");
      }
      values.push(a / b);
    }
  };

  let previousType = "operator";

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (/^\d+(?:\.\d+)?$/.test(token)) {
      values.push(parseFloat(token));
      previousType = "number";
      continue;
    }

    if (token === "(") {
      if (previousType === "number") {
        throw new Error("invalid");
      }
      operators.push(token);
      previousType = "operator";
      continue;
    }

    if (token === ")") {
      while (operators.length && operators[operators.length - 1] !== "(") {
        applyOperator();
      }
      if (!operators.length || operators.pop() !== "(") {
        throw new Error("invalid");
      }
      previousType = "number";
      continue;
    }

    if (isOperator(token)) {
      if (previousType === "operator") {
        if (token === "-" && (i === 0 || tokens[i - 1] === "(" || isOperator(tokens[i - 1]))) {
          values.push(0);
        } else {
          throw new Error("invalid");
        }
      }

      while (
        operators.length &&
        operators[operators.length - 1] !== "(" &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        applyOperator();
      }

      operators.push(token);
      previousType = "operator";
      continue;
    }

    throw new Error("invalid");
  }

  if (previousType === "operator") {
    throw new Error("invalid");
  }

  while (operators.length) {
    const nextOperator = operators[operators.length - 1];
    if (nextOperator === "(" || nextOperator === ")") {
      throw new Error("invalid");
    }
    applyOperator();
  }

  return values[0];
}

function updateDisplay() {
  expressionEl.textContent = expression || "0";

  if (!expression) {
    resultEl.textContent = "0";
    clearError();
    return;
  }

  const safeExpression = sanitizeExpression(expression);
  if (!safeExpression) {
    resultEl.textContent = "0";
    return;
  }

  const preview = trimPreviewExpression(safeExpression);
  if (!preview) {
    resultEl.textContent = "0";
    return;
  }

  try {
    const value = evaluateExpression(preview);
    lastResult = formatResult(value);
    resultEl.textContent = lastResult;
    clearError();
    animateResult();
  } catch (error) {
    if (error.message === "divideByZero") {
      showError("Cannot divide by zero");
    } else {
      resultEl.textContent = lastResult || "0";
      clearError();
    }
  }
}

function appendValue(value) {
  if (value === ".") {
    if (!canAppendDot()) {
      return;
    }
    if (!expression || isOperator(getLastCharacter()) || getLastCharacter() === "(") {
      expression += "0";
    }
  }

  if (isOperator(value)) {
    if (!canAppendOperator(value)) {
      return;
    }
  }

  if (expression === "0" && value !== "." && !isOperator(value)) {
    expression = value;
  } else {
    expression += value;
  }

  updateDisplay();
}

function handleAction(action) {
  if (action === "clear") {
    expression = "";
    updateDisplay();
    return;
  }

  if (action === "delete") {
    expression = expression.slice(0, -1);
    updateDisplay();
    return;
  }

  if (action === "equals") {
    const safeExpression = sanitizeExpression(expression);
    try {
      const value = evaluateExpression(safeExpression);
      const formatted = formatResult(value);
      addHistoryItem(expression, formatted);
      expression = formatted;
      lastResult = formatted;
      updateDisplay();
    } catch (error) {
      if (error.message === "divideByZero") {
        showError("Cannot divide by zero");
      } else {
        showError("Invalid Expression");
      }
    }
  }
}

function getHistoryFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEYS.history);
  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function saveHistoryToStorage() {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
}

function formatHistoryEntry(entry) {
  return `${entry.expression} = ${entry.result}`;
}

function createHistoryItem(entry) {
  const item = document.createElement("li");
  item.className = "history-item";
  item.tabIndex = 0;
  item.textContent = formatHistoryEntry(entry);

  item.addEventListener("click", () => {
    expression = entry.expression;
    updateDisplay();
  });

  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      expression = entry.expression;
      updateDisplay();
    }
  });

  return item;
}

function renderHistory() {
  historyList.innerHTML = "";
  historyCount.textContent = history.length;

  history.forEach((entry) => {
    historyList.appendChild(createHistoryItem(entry));
  });
}

function addHistoryItem(expressionValue, resultValue) {
  if (!expressionValue) {
    return;
  }

  history = [{ expression: expressionValue, result: resultValue }, ...history].slice(0, 10);
  saveHistoryToStorage();
  renderHistory();
}

function clearHistory() {
  history = [];
  saveHistoryToStorage();
  renderHistory();
}

function toggleHistory() {
  const expanded = historyToggle.getAttribute("aria-expanded") === "true";
  historyToggle.setAttribute("aria-expanded", String(!expanded));
  historyContent.classList.toggle("expanded", !expanded);
}

function copyResult() {
  const value = resultEl.textContent.trim();
  if (!value) {
    return;
  }

  navigator.clipboard
    .writeText(value)
    .then(() => showToast("Copied!"))
    .catch(() => showToast("Unable to copy"));
}

function highlightButtonForKey(key) {
  let button = document.querySelector(`[data-value="${key}"]`);

  if (!button) {
    if (key === "Enter" || key === "=") {
      button = document.querySelector("[data-action='equals']");
    }
    if (key === "Backspace") {
      button = document.querySelector("[data-action='delete']");
    }
    if (key === "Escape") {
      button = document.querySelector("[data-action='clear']");
    }
  }

  if (button) {
    button.classList.add("active");
    setTimeout(() => button.classList.remove("active"), 250);
  }
}

function setupEventListeners() {
  buttons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const action = button.dataset.action;
      const value = button.dataset.value;

      if (action) {
        handleAction(action);
      } else if (value) {
        appendValue(value);
      }

      createRipple(button, event);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    const key = event.key;
    highlightButtonForKey(key);

    if (/^[0-9.]$/.test(key)) {
      event.preventDefault();
      appendValue(key);
      return;
    }

    if (["+", "-", "*", "/"].includes(key)) {
      event.preventDefault();
      appendValue(key);
      return;
    }

    if (key === "Enter" || key === "=") {
      event.preventDefault();
      handleAction("equals");
      return;
    }

    if (key === "Backspace") {
      event.preventDefault();
      handleAction("delete");
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      handleAction("clear");
      return;
    }
  });

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(currentTheme === "light" ? "dark" : "light");
  });

  copyButton.addEventListener("click", () => {
    copyResult();
  });

  historyToggle.addEventListener("click", toggleHistory);
  clearHistoryButton.addEventListener("click", clearHistory);
}

function initialize() {
  loadTheme();
  history = getHistoryFromStorage();
  renderHistory();
  setupEventListeners();
  updateDisplay();
}

initialize();
