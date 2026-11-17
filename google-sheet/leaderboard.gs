/**
 * The shared leaderboard for Ground Truth, the hidden game, kept in a Google Sheet.
 *
 * Setup, once:
 *   1. Create a Google Sheet (sheets.new) and open Extensions > Apps Script.
 *   2. Replace the editor's contents with this file and save.
 *   3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *   4. Copy the web app URL (it ends in /exec) and give it to the site, as the README describes.
 *
 * The game reads the board with a GET and posts a score with a POST. Scores land in a tab named
 * "Scores", one row each, which you can sort, edit, or delete like any spreadsheet. Only this
 * script writes to the sheet for visitors: the sheet itself does not need to be shared.
 *
 * After changing this file, deploy it again with Deploy > Manage deployments > Edit > New
 * version, so the URL stays the same.
 *
 * The tag below limits what Google lets this script touch to the one spreadsheet it is attached
 * to, instead of every spreadsheet in the account. Keep it.
 *
 * @OnlyCurrentDoc
 */

const SHEET_NAME = 'Scores';
const BOARD_SIZE = 10;
const MAX_SCORE = 200000;
const MAX_WAVE = 500;
/** Initials that are never stored, as on any arcade cabinet. */
const BLOCKED =
  'ASS FUK FUC FCK FUX SEX CUM FAG NIG NGR KKK TIT DIK DIC COK KOK PUS JEW NAZ HOR SUK JIZ CNT KYS'.split(
    ' ',
  );

/** Read the board: the ten best scores, best first. */
function doGet() {
  return respond(topScores(scoresSheet()));
}

/** Post a score, sent as JSON text: {"name": "ABC", "score": 1234, "wave": 5}. */
function doPost(event) {
  let entry;
  try {
    entry = JSON.parse(event.postData.contents);
  } catch (error) {
    return respond({ error: 'The score could not be read.' });
  }
  const name = String(entry.name || '');
  const score = Number(entry.score);
  const wave = Number(entry.wave);
  if (!isValidName(name) || !isWhole(score, 1, MAX_SCORE) || !isWhole(wave, 1, MAX_WAVE)) {
    return respond({ error: 'That is not a score the game could have produced.' });
  }

  // One writer at a time, so two scores posted together both land.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = scoresSheet();
    sheet.appendRow([new Date(), name, score, wave]);
    return respond(topScores(sheet));
  } finally {
    lock.releaseLock();
  }
}

function isValidName(name) {
  return /^[A-Z0-9]{1,3}$/.test(name) && BLOCKED.indexOf(name) === -1;
}

function isWhole(value, least, most) {
  return Number.isInteger(value) && value >= least && value <= most;
}

/** The tab that holds the scores, made with its header row the first time it is needed. */
function scoresSheet() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
    sheet.appendRow(['When', 'Initials', 'Score', 'Wave']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function topScores(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet
    .getRange(2, 1, last - 1, 4)
    .getValues()
    .map(function (row) {
      const when = row[0] instanceof Date ? row[0] : new Date(row[0]);
      return {
        at: isNaN(when.getTime()) ? '' : when.toISOString(),
        name: String(row[1]).toUpperCase(),
        score: Number(row[2]),
        wave: Number(row[3]),
      };
    })
    .filter(function (entry) {
      // Rows edited by hand into something that is not a score are skipped, not shown.
      return (
        entry.at !== '' &&
        isValidName(entry.name) &&
        isWhole(entry.score, 1, MAX_SCORE) &&
        isWhole(entry.wave, 1, MAX_WAVE)
      );
    })
    .sort(function (a, b) {
      return b.score - a.score || a.at.localeCompare(b.at);
    })
    .slice(0, BOARD_SIZE);
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
