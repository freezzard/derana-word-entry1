// derana-word-entry1 — Invent a Word We Need
//
// The entry coins one new English word and defines it in a single clear
// line. The program below builds that line from fixed parts, checks it
// against the competition gate, and writes it to /output/entry.txt.
//
// The word: phonnesia
//   A blend of phone and amnesia. It names the moment a person unlocks a
//   phone to do one thing, then forgets what that thing was the moment
//   the screen lights up. English has no single word for that lapse, and
//   nearly every phone owner has felt it at least once a week.
//
// The gate, from the kit rules:
//   /output/entry.txt holds UTF-8 text of 1 to 140 characters, holding
//   more than white space alone. A single line, no trailing newline.
//
// The program is fully deterministic: fixed text in, fixed bytes out.
// It reads no network, no clock, no random source, and no environment
// input. Running it twice yields byte-identical output.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Fixed entry text
// ---------------------------------------------------------------------------

const WORD = "phonnesia";

const DEFINITION_BODY =
  "unlocking your phone to do one thing, then forgetting what it was " +
  "the moment the screen lights up.";

const SEPARATOR = ": ";

const OUTPUT_PATH = "/output/entry.txt";

const MIN_CHARS = 1;

const MAX_CHARS = 140;

const MAX_BYTES = 140;

// ---------------------------------------------------------------------------
// Small measuring helpers
// ---------------------------------------------------------------------------

function countCodePoints(text: string): number {
  return [...text].length;
}

function countBytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function countWords(text: string): number {
  const parts = text.split(/\s+/u);
  const words: string[] = [];
  for (const part of parts) {
    if (part.length > 0) {
      words.push(part);
    }
  }
  return words.length;
}

function hasOnlyWhitespace(text: string): boolean {
  return text.trim().length === 0;
}

function hasSingleLine(text: string): boolean {
  if (text.includes("\n")) {
    return false;
  }
  if (text.includes("\r")) {
    return false;
  }
  return true;
}

function countStops(text: string): number {
  let total = 0;
  for (const ch of text) {
    if (ch === ".") {
      total = total + 1;
    }
  }
  return total;
}

function isAscii(text: string): boolean {
  for (const ch of text) {
    if (ch.codePointAt(0) as number > 127) {
      return false;
    }
  }
  return true;
}

function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

// ---------------------------------------------------------------------------
// Entry assembly
// ---------------------------------------------------------------------------

function buildEntry(): string {
  return WORD + SEPARATOR + DEFINITION_BODY;
}

function headwordOf(entry: string): string {
  const mark = entry.indexOf(SEPARATOR);
  if (mark < 0) {
    return "";
  }
  return entry.slice(0, mark);
}

function definitionOf(entry: string): string {
  const mark = entry.indexOf(SEPARATOR);
  if (mark < 0) {
    return "";
  }
  return entry.slice(mark + SEPARATOR.length);
}

// ---------------------------------------------------------------------------
// Gate validation
//
// Every rule the sealed scorer applies is mirrored here, plus a few
// structural checks of our own: the headword is one alphabetic token,
// the definition is a single sentence that ends with a full stop, the
// entry carries no leading or trailing white space, and the definition
// mentions the phone, the forgetting, and the screen, so the meaning
// lands in one reading with no second sentence needed.
// ---------------------------------------------------------------------------

function validateEntry(entry: string): string[] {
  const issues: string[] = [];

  const chars = countCodePoints(entry);
  if (chars < MIN_CHARS) {
    issues.push("entry is shorter than " + MIN_CHARS + " character");
  }
  if (chars > MAX_CHARS) {
    issues.push("entry is " + chars + " characters, over the 140 limit");
  }

  const bytes = countBytes(entry);
  if (bytes > MAX_BYTES) {
    issues.push("entry is " + bytes + " bytes, over the 140 byte budget");
  }

  if (hasOnlyWhitespace(entry)) {
    issues.push("entry holds only white space");
  }

  if (entry !== entry.trim()) {
    issues.push("entry carries leading or trailing white space");
  }

  if (hasSingleLine(entry) === false) {
    issues.push("entry spans more than one line");
  }

  const headword = headwordOf(entry);
  if (headword.length === 0) {
    issues.push("entry has no headword before the separator");
  }
  if (headword.length > 0) {
    if (/^[a-z]+$/u.test(headword) === false) {
      issues.push("headword must be one lowercase alphabetic token");
    }
  }

  const definition = definitionOf(entry);
  if (definition.length === 0) {
    issues.push("entry has no definition after the separator");
  }
  if (definition.length > 0) {
    if (definition.endsWith(".") === false) {
      issues.push("definition must end with a full stop");
    }
    if (countStops(definition) !== 1) {
      issues.push("definition must hold exactly one full stop");
    }
    if (definition.includes("phone") === false) {
      issues.push("definition must name the phone");
    }
    if (definition.includes("forgetting") === false) {
      issues.push("definition must name the forgetting");
    }
    if (definition.includes("screen") === false) {
      issues.push("definition must name the screen");
    }
  }

  return issues;
}

function assertValid(entry: string): void {
  const issues = validateEntry(entry);
  if (issues.length === 0) {
    return;
  }
  const lines: string[] = [];
  lines.push("entry failed validation:");
  for (const issue of issues) {
    lines.push("- " + issue);
  }
  throw new Error(lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function writeEntry(entry: string): { bytes: number; sha256: string } {
  const parent = dirname(OUTPUT_PATH);
  mkdirSync(parent, { recursive: true });
  const payload = Buffer.from(entry, "utf8");
  writeFileSync(OUTPUT_PATH, payload);
  const roundTrip = readFileSync(OUTPUT_PATH);
  if (Buffer.compare(payload, roundTrip) !== 0) {
    throw new Error("round-trip read of " + OUTPUT_PATH + " differs");
  }
  if (roundTrip.toString("utf8") !== entry) {
    throw new Error("UTF-8 round-trip of the entry differs");
  }
  return { bytes: payload.length, sha256: sha256Hex(payload) };
}

function describeEntry(entry: string): Record<string, unknown> {
  return {
    word: headwordOf(entry),
    chars: countCodePoints(entry),
    bytes: countBytes(entry),
    words: countWords(entry),
    lines: 1,
    ascii: isAscii(entry),
    text: entry,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const entry = buildEntry();
  assertValid(entry);
  const written = writeEntry(entry);
  const report = describeEntry(entry);
  report.path = OUTPUT_PATH;
  report.sha256 = written.sha256;
  report.status = "ok";
  console.log(JSON.stringify(report, null, 2));
}

main();
