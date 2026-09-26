/**
 * Helpers for interpreting legacy step text during import.
 *
 * A cell is "numbered" when every non-blank line group starts with a marker such
 * as "1.", "1)", "Step 1:", or "#1". Text that is not numbered is treated as a
 * single block. Nothing here guesses how to pair mismatched lists; callers flag
 * those rows for review instead.
 */
const MARKER = /^\s*(?:step\s*)?#?(\d+)\s*[.):\-]\s*/i;

export type ParsedList = { numbered: boolean; items: string[] };

export function splitNumbered(text: string): ParsedList {
  const trimmed = text.replace(/\r\n?/g, "\n").trim();
  if (!trimmed) return { numbered: false, items: [] };

  const lines = trimmed.split("\n");
  const first = lines[0].match(MARKER);
  if (!first || Number(first[1]) !== 1) return { numbered: false, items: [trimmed] };

  const items: string[] = [];
  let expected = 1;
  for (const line of lines) {
    const m = line.match(MARKER);
    if (m && Number(m[1]) === expected) {
      items.push(line.replace(MARKER, "").trim());
      expected++;
    } else if (items.length) {
      // Continuation line of the previous item.
      items[items.length - 1] = `${items[items.length - 1]}\n${line.trim()}`.trim();
    }
  }
  return { numbered: true, items: items.map((s) => s.trim()) };
}

export type StepPair = { action: string; expectedResult: string };
export type PairResult = { ok: true; steps: StepPair[] } | { ok: false; error: string };

/** Pairs a single steps cell with a single expected-results cell. */
export function pairStepText(stepsText: string, expectedText: string): PairResult {
  const steps = splitNumbered(stepsText);
  const expected = splitNumbered(expectedText);

  if (!steps.items.length) {
    if (expected.items.length) {
      return { ok: false, error: "Expected result is present but there are no steps to attach it to." };
    }
    return { ok: true, steps: [] };
  }
  if (!expected.items.length) {
    return { ok: true, steps: steps.items.map((action) => ({ action, expectedResult: "" })) };
  }
  if (steps.items.length === expected.items.length) {
    return {
      ok: true,
      steps: steps.items.map((action, i) => ({ action, expectedResult: expected.items[i] })),
    };
  }
  return {
    ok: false,
    error: `Found ${steps.items.length} step(s) but ${expected.items.length} expected result(s); cannot pair them safely. Number the expected results to match the steps, or edit the row.`,
  };
}

/** Pairs values from multiple step / expected columns by their position. */
export function pairStepColumns(stepCells: string[], expectedCells: string[]): PairResult {
  const count = Math.max(stepCells.length, expectedCells.length);
  const steps: StepPair[] = [];
  for (let i = 0; i < count; i++) {
    const action = (stepCells[i] ?? "").trim();
    const expectedResult = (expectedCells[i] ?? "").trim();
    if (!action && !expectedResult) continue;
    if (!action) {
      return { ok: false, error: `Expected result in column #${i + 1} has no matching step.` };
    }
    steps.push({ action, expectedResult });
  }
  return { ok: true, steps };
}
