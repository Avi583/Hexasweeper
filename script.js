/* ===========================================================
   Hexasweeper
   Pointy-top hexagons, "odd-r" offset grid (honeycomb layout).
   Neighbor math is done by converting offset <-> axial coords,
   which avoids fragile parity-lookup tables.
=========================================================== */

const SVG_NS = "http://www.w3.org/2000/svg";
const HEX_SIZE = 26; // center-to-vertex radius, px
const PADDING = 24;

const PRESETS = {
  beginner:     { cols: 9,  rows: 9,  mines: 10 },
  intermediate: { cols: 13, rows: 11, mines: 25 },
  expert:       { cols: 17, rows: 15, mines: 55 },
};

const AXIAL_DIRECTIONS = [
  { dq: 1, dr: 0 }, { dq: 1, dr: -1 }, { dq: 0, dr: -1 },
  { dq: -1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 0, dr: 1 },
];

// ---- offset <-> axial conversion (odd-r layout) ----
function oddrToAxial(col, row) {
  const q = col - (row - (row & 1)) / 2;
  return { q, r: row };
}
function axialToOddr(q, r) {
  const col = q + (r - (r & 1)) / 2;
  return { col, row: r };
}
function getNeighborCoords(col, row, cols, rows) {
  const { q, r } = oddrToAxial(col, row);
  const out = [];
  for (const { dq, dr } of AXIAL_DIRECTIONS) {
    const { col: nc, row: nr } = axialToOddr(q + dq, r + dr);
    if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) out.push({ col: nc, row: nr });
  }
  return out;
}

// ---- pixel geometry ----
function hexCenter(col, row) {
  const w = Math.sqrt(3) * HEX_SIZE;
  const h = 2 * HEX_SIZE;
  const x = col * w + (row % 2 === 1 ? w / 2 : 0) + w / 2 + PADDING;
  const y = row * h * 0.75 + h / 2 + PADDING;
  return { x, y };
}
function hexPoints(cx, cy) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + HEX_SIZE * Math.cos(angle)},${cy + HEX_SIZE * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

// ---- game state ----
let cols, rows, mineCount;
let grid = [];           // grid[row][col] = { mine, revealed, flagged, adjacent }
let firstClickDone = false;
let gameOver = false;
let revealedSafeCount = 0;
let flagCount = 0;
let timerHandle = null;
let elapsed = 0;
let cellEls = {}; // "col,row" -> { poly, label }

const boardSvg = document.getElementById("board");
const boardScroll = document.getElementById("board-scroll");
const mineCounterEl = document.getElementById("mine-counter");
const timerEl = document.getElementById("timer");
const restartBtn = document.getElementById("restart-btn");
const difficultySel = document.getElementById("difficulty");
const customPanel = document.getElementById("custom-panel");
const customApply = document.getElementById("custom-apply");
const toastEl = document.getElementById("toast");
const flagModeCheckbox = document.getElementById("flag-mode");

function key(col, row) { return `${col},${row}`; }

function newGame(config) {
  ({ cols, rows, mines: mineCount } = { cols: config.cols, rows: config.rows, mines: config.mines });
  grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  );
  firstClickDone = false;
  gameOver = false;
  revealedSafeCount = 0;
  flagCount = 0;
  clearInterval(timerHandle);
  timerHandle = null;
  elapsed = 0;
  updateTimerDisplay();
  updateMineCounter();
  restartBtn.textContent = "🙂";
  hideToast();
  renderBoard();
}

function placeMines(safeCol, safeRow) {
  const safeZone = new Set([key(safeCol, safeRow)]);
  for (const n of getNeighborCoords(safeCol, safeRow, cols, rows)) safeZone.add(key(n.col, n.row));

  const allCells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!safeZone.has(key(c, r))) allCells.push({ c, r });
  }
  // shuffle
  for (let i = allCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
  }
  const count = Math.min(mineCount, allCells.length);
  for (let i = 0; i < count; i++) {
    const { c, r } = allCells[i];
    grid[r][c].mine = true;
  }
  mineCount = count; // in case grid too small for requested mine count

  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r][c].mine) continue;
    let n = 0;
    for (const nb of getNeighborCoords(c, r, cols, rows)) if (grid[nb.row][nb.col].mine) n++;
    grid[r][c].adjacent = n;
  }
}

// ---- rendering ----
function renderBoard() {
  boardSvg.innerHTML = "";
  cellEls = {};

  const w = Math.sqrt(3) * HEX_SIZE;
  const h = 2 * HEX_SIZE;
  const totalW = cols * w + w / 2 + PADDING * 2;
  const totalH = rows * h * 0.75 + h * 0.25 + PADDING * 2;
  boardSvg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
  boardSvg.setAttribute("width", totalW);
  boardSvg.setAttribute("height", totalH);

  const defs = document.createElementNS(SVG_NS, "defs");
  defs.innerHTML = `
    <linearGradient id="combGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--comb-top)"/>
      <stop offset="100%" stop-color="var(--comb-bottom)"/>
    </linearGradient>`;
  boardSvg.appendChild(defs);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { x, y } = hexCenter(c, r);
      const poly = document.createElementNS(SVG_NS, "polygon");
      poly.setAttribute("points", hexPoints(x, y));
      poly.setAttribute("class", "hex unrevealed");
      poly.dataset.col = c;
      poly.dataset.row = r;

      poly.addEventListener("click", () => onLeftClick(c, r));
      poly.addEventListener("dblclick", (e) => { e.preventDefault(); onChord(c, r); });
      poly.addEventListener("contextmenu", (e) => { e.preventDefault(); onRightClick(c, r); });
      poly.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
      poly.addEventListener("auxclick", (e) => {
        if (e.button === 1) { e.preventDefault(); onChord(c, r); }
      });

      boardSvg.appendChild(poly);

      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", x);
      label.setAttribute("y", y + 1);
      label.setAttribute("font-size", HEX_SIZE * 0.85);
      label.setAttribute("class", "hex-emoji");
      label.style.display = "none";
      boardSvg.appendChild(label);

      cellEls[key(c, r)] = { poly, label, x, y };
    }
  }
}

function updateCellVisual(c, r) {
  const cell = grid[r][c];
  const el = cellEls[key(c, r)];
  if (!el) return;
  const { poly, label } = el;

  if (cell.flagged && !cell.revealed) {
    poly.setAttribute("class", "hex unrevealed flagged");
    label.style.display = "block";
    label.textContent = "🚩";
    label.setAttribute("class", "hex-emoji pop");
    label.setAttribute("font-size", HEX_SIZE * 0.85);
    return;
  }
  if (!cell.revealed) {
    poly.setAttribute("class", "hex unrevealed");
    label.style.display = "none";
    return;
  }
  // revealed
  if (cell.mine) {
    poly.setAttribute("class", cell.exploded ? "hex mine-hit" : "hex mine-shown");
    label.style.display = "block";
    label.textContent = "💣";
    label.setAttribute("class", "hex-emoji pop");
    label.setAttribute("font-size", HEX_SIZE * 0.85);
  } else {
    poly.setAttribute("class", "hex revealed");
    if (cell.adjacent > 0) {
      label.style.display = "block";
      label.textContent = cell.adjacent;
      label.setAttribute("class", `hex-label pop n${cell.adjacent}`);
      label.setAttribute("font-size", HEX_SIZE * 0.9);
    } else {
      label.style.display = "none";
    }
  }
}

// ---- game actions ----
function onLeftClick(c, r) {
  if (gameOver) return;

  if (flagModeCheckbox && flagModeCheckbox.checked) {
    onRightClick(c, r);
    return;
  }

  const cell = grid[r][c];
  if (cell.flagged || cell.revealed) return;

  if (!firstClickDone) {
    placeMines(c, r);
    firstClickDone = true;
    startTimer();
  }

  revealCell(c, r);
  checkWin();
}

function revealCell(c, r) {
  const cell = grid[r][c];
  if (cell.revealed || cell.flagged) return;
  cell.revealed = true;
  updateCellVisual(c, r);

  if (cell.mine) {
    cell.exploded = true;
    updateCellVisual(c, r);
    endGame(false);
    return;
  }

  revealedSafeCount++;

  if (cell.adjacent === 0) {
    for (const n of getNeighborCoords(c, r, cols, rows)) {
      if (!grid[n.row][n.col].revealed) revealCell(n.col, n.row);
    }
  }
}

function onRightClick(c, r) {
  if (gameOver) return;
  const cell = grid[r][c];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;
  updateCellVisual(c, r);
  updateMineCounter();
}

function onChord(c, r) {
  if (gameOver) return;
  const cell = grid[r][c];
  if (!cell.revealed || cell.adjacent === 0) return;
  const neighbors = getNeighborCoords(c, r, cols, rows);
  const flagged = neighbors.filter(n => grid[n.row][n.col].flagged).length;
  if (flagged !== cell.adjacent) return;
  for (const n of neighbors) {
    if (!grid[n.row][n.col].flagged && !grid[n.row][n.col].revealed) revealCell(n.col, n.row);
  }
  checkWin();
}

function checkWin() {
  if (gameOver) return;
  const totalCells = rows * cols;
  if (revealedSafeCount === totalCells - mineCount) {
    endGame(true);
  }
}

function endGame(won) {
  gameOver = true;
  clearInterval(timerHandle);
  restartBtn.textContent = won ? "🐝" : "💥";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.mine && !cell.revealed) {
        if (won) cell.flagged = true;
        else cell.revealed = true;
        updateCellVisual(c, r);
      }
      if (!won && cell.flagged && !cell.mine) {
        // mark wrong flags subtly by leaving flag; optional enhancement skipped
      }
    }
  }
  if (won) {
    flagCount = mineCount;
    updateMineCounter();
    showToast("You cleared the comb! 🐝");
  } else {
    showToast("Boom! The hive collapsed.");
  }
}

function startTimer() {
  timerHandle = setInterval(() => {
    elapsed = Math.min(elapsed + 1, 999);
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  timerEl.textContent = String(elapsed).padStart(3, "0");
}
function updateMineCounter() {
  const remaining = Math.max(-99, Math.min(999, mineCount - flagCount));
  mineCounterEl.textContent = String(remaining).padStart(3, "0");
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
}
function hideToast() { toastEl.hidden = true; }

// ---- controls wiring ----
restartBtn.addEventListener("click", () => newGame(currentConfig()));

function currentConfig() {
  if (difficultySel.value === "custom") {
    return {
      cols: clamp(parseInt(document.getElementById("custom-cols").value, 10) || 9, 4, 30),
      rows: clamp(parseInt(document.getElementById("custom-rows").value, 10) || 9, 4, 30),
      mines: Math.max(1, parseInt(document.getElementById("custom-mines").value, 10) || 10),
    };
  }
  return PRESETS[difficultySel.value] || PRESETS.beginner;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

difficultySel.addEventListener("change", () => {
  customPanel.hidden = difficultySel.value !== "custom";
  if (difficultySel.value !== "custom") newGame(currentConfig());
});
customApply.addEventListener("click", () => newGame(currentConfig()));

boardScroll.addEventListener("contextmenu", (e) => e.preventDefault());

// ---- boot ----
newGame(PRESETS.beginner);
