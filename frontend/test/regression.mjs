import { chromium } from "playwright";

// Regression guard for the two bugs found by headless testing:
//  1. the full-screen "unsupported" overlay swallowed every click
//  2. stopping with no speech left the button stuck on "Sending..."
const fakeIdle = `
class FakeSR {
  constructor(){ this._fin=false; }
  start(){ this.onstart?.(); }
  stop(){ if(this._fin)return; this._fin=true; this.onend?.(); }
  abort(){ this.stop(); }
}
window.SpeechRecognition=FakeSR; window.webkitSpeechRecognition=FakeSR;
`;

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

const browser = await chromium.launch({ headless: true });
let failures = 0;
const check = (name, pass, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " -> " + detail : ""}`);
  if (!pass) failures++;
};

// 1. overlay must not exist for the user, and must not swallow clicks
const page = await browser.newPage();
await page.addInitScript(fakeIdle);
await page.goto(BASE_URL, { waitUntil: "load" });

const overlay = await page.evaluate(() => {
  const el = document.getElementById("unsupported");
  return { hidden: el.hidden, display: getComputedStyle(el).display };
});
check("overlay hidden", overlay.hidden === true, JSON.stringify(overlay));
check("overlay not displayed", overlay.display === "none", overlay.display);

const box = await page.locator("#btn_record").boundingBox();
const topmost = await page.evaluate(
  ([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? `${el.tagName}#${el.id || ""}` : "none";
  },
  [box.x + box.width / 2, box.y + box.height / 2]
);
check(
  "mic button is clickable (nothing on top)",
  topmost === "BUTTON#btn_record" || topmost === "SPAN#btn_record_label",
  topmost
);

// 2. stopping with no captured speech must restore the button
await page.click("#btn_record");
await new Promise((r) => setTimeout(r, 150));
await page.click("#btn_record");
await new Promise((r) => setTimeout(r, 400));

const after = await page.evaluate(() => ({
  label: document.getElementById("btn_record_label").textContent,
  state: document.getElementById("btn_record").dataset.state,
  disabled: document.getElementById("btn_record").disabled,
  status: document.getElementById("status_text").textContent,
}));
check(
  "button resets after empty stop",
  after.label === "Start speaking" && !after.disabled && after.state === "idle",
  JSON.stringify(after)
);

// 3. secure-context messaging when the API really is absent
const page2 = await browser.newPage();
await page2.addInitScript(`
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
`);
await page2.goto(BASE_URL, { waitUntil: "load" });
const notice = await page2.evaluate(() => {
  const el = document.getElementById("unsupported");
  return {
    shown: !el.hidden,
    display: getComputedStyle(el).display,
    text: el.querySelector(".unsupported__reason")?.textContent?.trim() || "",
  };
});
check("notice shows when API missing", notice.shown && notice.display !== "none");
const fullNotice = await page2.evaluate(
  () => document.getElementById("unsupported").innerText
);
check(
  "notice names the actual reason",
  // On a secure origin in Chrome, the correct diagnosis is the
  // browser/content-settings branch, not the insecure-origin one.
  /secure|extension|chrome:\/\/settings/i.test(fullNotice),
  fullNotice.replace(/\s+/g, " ").slice(0, 90)
);

await browser.close();
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
