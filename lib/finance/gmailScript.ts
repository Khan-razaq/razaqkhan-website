// The Google Apps Script that copies bank alert emails from Gmail to the
// finance inbox. It's pasted into script.google.com (free, runs on Google's
// side every 5 minutes) and only reads emails labelled "Bank alerts".
//
// It sends each email as-is; all the reading happens on the site, so
// improving the reader never needs the script changed.

export function gmailScript(opts: { key: string; supabaseUrl: string; publicKey: string }): string {
  return `// Copies emails labelled "Bank alerts" to your finance inbox on your website.
// Runs every 5 minutes once you've run setup() once.

const KEY = '${opts.key}';
const ENDPOINT = '${opts.supabaseUrl}/rest/v1/rpc/ingest_bank_alert';
// The website's public database key (the same one every visitor's browser has).
const PUBLIC_KEY = '${opts.publicKey}';

// Run this once by hand: it starts the 5-minute timer and copies the last 60
// days of alerts.
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncBankAlerts').timeBased().everyMinutes(5).create();
  syncBankAlerts();
}

function syncBankAlerts() {
  const props = PropertiesService.getScriptProperties();
  const since = Number(props.getProperty('since') || 0);
  // A day of overlap so nothing is missed; the site ignores repeats.
  const query = since
    ? 'label:bank-alerts after:' + Math.floor(since / 1000 - 86400)
    : 'label:bank-alerts newer_than:60d';

  let newest = since;
  for (let start = 0; ; start += 100) {
    const threads = GmailApp.search(query, start, 100);
    threads.forEach(function (thread) {
      thread.getMessages().forEach(function (msg) {
        const time = msg.getDate().getTime();
        if (time <= since) return;
        send(msg);
        newest = Math.max(newest, time);
      });
    });
    if (threads.length < 100) break;
  }
  // Only moves forward once everything above was sent; a failure throws
  // before this line, and the next run tries again.
  props.setProperty('since', String(newest));
}

function send(msg) {
  const res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: PUBLIC_KEY, Authorization: 'Bearer ' + PUBLIC_KEY },
    payload: JSON.stringify({
      p_key: KEY,
      p_message_id: msg.getId(),
      p_sender: msg.getFrom(),
      p_subject: msg.getSubject(),
      // Both versions of the email: some banks (Citi) put the store name
      // only in the designed one.
      p_body: (msg.getPlainBody().slice(0, 6000) + '\\n----\\n' + toText(msg.getBody())).slice(0, 14000),
      p_email_date: msg.getDate().toISOString(),
    }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('Website said ' + res.getResponseCode() + ': ' + res.getContentText());
  }
}

// The words of an HTML email, one table cell or paragraph per line.
function toText(html) {
  return html
    .replace(/<(style|script|head)[\\s\\S]*?<\\/\\1>/gi, '')
    .replace(/<br\\s*\\/?>|<\\/(p|div|td|th|tr|li|h\\d)>/gi, '\\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[ \\t]+/g, ' ')
    .replace(/ *\\n[\\s]*/g, '\\n')
    .trim();
}
`;
}
