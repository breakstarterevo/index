// sort.js — BSL Table Sorter + Player Page Enhancements

document.addEventListener('DOMContentLoaded', function () {

  // ── 1. SORT ─────────────────────────────────────────────────────

  var gradeOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5 };

  document.querySelectorAll('table').forEach(function (table) {
    var headers = table.querySelectorAll('td.header');
    if (headers.length === 0) return;

    headers.forEach(function (header, col) {
      if (!header.innerText.replace(/[^a-zA-Z0-9]/g, '').trim()) return;

      header.style.cursor = 'pointer';
      header.style.userSelect = 'none';

      var arrow = document.createElement('span');
      arrow.style.cssText = 'margin-left:3px;opacity:0.45;font-size:6px;font-family:monospace;';
      arrow.textContent = 'v';
      header.appendChild(arrow);

      var asc = true;

      header.addEventListener('click', function () {
        var tbody = table.querySelector('tbody');
        if (!tbody) return;

        // Only direct child rows — ignores nested table rows
        var rows = Array.from(tbody.children).filter(function (r) {
          return r.classList.contains('row1') || r.classList.contains('row2');
        });
        if (rows.length === 0) return;

        // Reset all arrows
        headers.forEach(function (h) {
          var a = h.querySelector('span');
          if (a) { a.textContent = 'v'; a.style.opacity = '0.45'; }
        });

        rows.sort(function (a, b) {
          // Only direct child td elements — ignores nested table cells
          var aCells = Array.from(a.children);
          var bCells = Array.from(b.children);
          var aCell = aCells[col];
          var bCell = bCells[col];
          var aText = (aCell ? ((aCell.dataset && aCell.dataset.sortValue) || aCell.innerText.trim()) : '');
          var bText = (bCell ? ((bCell.dataset && bCell.dataset.sortValue) || bCell.innerText.trim()) : '');

          // Grade sort (A/B/C/D/F)
          if (gradeOrder[aText] !== undefined && gradeOrder[bText] !== undefined) {
            return asc ? gradeOrder[aText] - gradeOrder[bText] : gradeOrder[bText] - gradeOrder[aText];
          }

          // Height sort e.g. 6-9, 7-0
          var aHt = aText.match(/^(\d+)-(\d+)$/);
          var bHt = bText.match(/^(\d+)-(\d+)$/);
          if (aHt && bHt) {
            var aIn = parseInt(aHt[1]) * 12 + parseInt(aHt[2]);
            var bIn = parseInt(bHt[1]) * 12 + parseInt(bHt[2]);
            return asc ? aIn - bIn : bIn - aIn;
          }

          // Numeric sort — strip $, commas, % and handle brackets e.g. ($0) -> -0
          var aClean = aText.replace(/[$,%]/g, '').replace(/^\((.+)\)$/, '-$1').replace(/,/g, '').trim();
          var bClean = bText.replace(/[$,%]/g, '').replace(/^\((.+)\)$/, '-$1').replace(/,/g, '').trim();
          var aNum = parseFloat(aClean);
          var bNum = parseFloat(bClean);
          if (!isNaN(aNum) && !isNaN(bNum)) return asc ? aNum - bNum : bNum - aNum;

          // Fallback: alphabetical
          return asc
            ? aText.localeCompare(bText, undefined, { sensitivity: 'base' })
            : bText.localeCompare(aText, undefined, { sensitivity: 'base' });
        });

        // Re-append sorted rows and restore zebra striping
        rows.forEach(function (row, i) {
          row.classList.remove('row1', 'row2');
          row.classList.add(i % 2 === 0 ? 'row1' : 'row2');
          tbody.appendChild(row);
        });

        arrow.textContent = asc ? ' ^' : ' v';
        arrow.style.opacity = '1';
        asc = !asc;
      });
    });
  });


  // ── 2. PLAYER PAGE FEATURES ─────────────────────────────────────
  // Detect player pages — look for tableheader containing "Season Averages"

  var isPlayerPage = Array.from(document.querySelectorAll('td.tableheader')).some(function (td) {
    var t = td.innerText.replace(/\u00a0/g, ' ').trim();
    return t === 'Season Averages' || t === 'Career Highs';
  });

  if (!isPlayerPage) return;


  // ── 2a. PERSONAL BEST BOLDING ────────────────────────────────────
  // Stat tables all start with a first header whose cleaned text is "SEASON", "TYPE", or "#"
  // Use &nbsp; stripping to reliably detect them

  var STAT_TABLE_STARTERS = ['SEASON', 'TYPE', '#', 'DATE'];

  document.querySelectorAll('table').forEach(function (table) {
    var tbody = table.querySelector('tbody');
    if (!tbody) return;

    var firstHeader = table.querySelector('td.header');
    if (!firstHeader) return;

    // Strip nbsp and whitespace for reliable matching
    var headerText = firstHeader.innerText.replace(/\u00a0/g, ' ').trim().toUpperCase();
    if (STAT_TABLE_STARTERS.indexOf(headerText) === -1) return;

    // Get data rows — exclude Career/Total/Type summary rows
    var rows = Array.from(tbody.children).filter(function (r) {
      if (!r.classList.contains('row1') && !r.classList.contains('row2')) return false;
      var firstCell = r.children[0];
      if (!firstCell) return false;
      var txt = firstCell.innerText.replace(/\u00a0/g, ' ').trim().toUpperCase();
      return txt !== 'CAREER' && txt !== 'TOTAL' && txt !== 'TYPE' && txt !== 'SEASON' && txt !== 'PLAYOFF';
    });

    if (rows.length < 2) return;

    var numCols = rows[0].children.length;

    for (var col = 1; col < numCols; col++) {
      var maxVal = -Infinity;
      var colCells = [];

      rows.forEach(function (row) {
        var cell = row.children[col];
        if (!cell) return;
        var txt = cell.innerText.replace(/\u00a0/g, ' ').trim().replace(/,/g, '');
        var num = parseFloat(txt);
        if (!isNaN(num)) {
          colCells.push({ cell: cell, val: num });
          if (num > maxVal) maxVal = num;
        }
      });

      if (colCells.length < 2 || maxVal === -Infinity) continue;

      colCells.forEach(function (item) {
        if (item.val === maxVal) {
          item.cell.style.fontWeight = '700';
          item.cell.style.color = '#0a6671';
        }
      });
    }
  });


  // ── 2b. GAME LOG SEARCH BAR ──────────────────────────────────────

  var gameLogTable = null;
  document.querySelectorAll('td.tableheader').forEach(function (td) {
    var t = td.innerText.replace(/\u00a0/g, ' ').trim();
    if (t === 'Game Logs') gameLogTable = td.closest('table');
  });

  if (gameLogTable) {
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom:6px;';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Filter game log by date, opponent...';
    input.style.cssText = [
      'width:280px',
      'padding:5px 10px',
      'font-size:12px',
      'font-family:inherit',
      'border:1px solid #d4d1ca',
      'border-radius:4px',
      'outline:none',
      'background:#fff',
      'color:#14202e'
    ].join(';');

    input.addEventListener('focus', function () { this.style.borderColor = '#0a6671'; });
    input.addEventListener('blur',  function () { this.style.borderColor = '#d4d1ca'; });

    wrapper.appendChild(input);
    gameLogTable.parentNode.insertBefore(wrapper, gameLogTable);

    var logTbody = gameLogTable.querySelector('tbody');

    input.addEventListener('input', function () {
      var query = this.value.trim().toLowerCase();
      if (!logTbody) return;
      Array.from(logTbody.children).forEach(function (row) {
        if (!row.classList.contains('row1') && !row.classList.contains('row2')) return;
        var text = row.innerText.toLowerCase();
        row.style.display = (!query || text.indexOf(query) !== -1) ? '' : 'none';
      });
    });
  }

});
