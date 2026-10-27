/* Type declarations for term.js — the Term spec's helpers for Node CLIs, the
   counterpart of sondalab-palette's `term`. Hand-written (see effects.d.ts); the
   constants are generated into term-tokens.d.ts and re-exported here. */

import type { GlyphName, Role } from "./term-tokens.js";

export * from "./term-tokens.js";

/** A colorMode() result. */
export type ColorMode = "none" | "ansi16" | "truecolor";

/** An environment to read; omitted, the helpers read process.env at call time. */
export type Env = Readonly<Record<string, string | undefined>>;

/** True when any variable of the ENV switch purpose is on ("reducedMotion", "accessible", "ci", "ascii").
 *  SONDALAB_* count only when "1"; CI and ACCESSIBLE whenever set. Another name throws RangeError. */
export declare function switchOn(name: string, env?: Env): boolean;

/** Accessible mode: SONDALAB_ACCESSIBLE=1, or ACCESSIBLE set (even empty). */
export declare function accessible(env?: Env): boolean;

/** SONDALAB_REDUCED_MOTION=1, or accessible(). */
export declare function reducedMotion(env?: Env): boolean;

/** Whether motion may run: off for a non-TTY stream (default: stderr), CI, TERM=dumb, reduced motion, accessible. */
export declare function motionEnabled(options?: { env?: Env; isTTY?: boolean }): boolean;

/** Whether every glyph takes its ASCII form: a non-UTF-8 locale charset, TERM=dumb or SONDALAB_ASCII=1.
 *  `override` is the --ascii flag; `encoding` replaces the locale charset. */
export declare function asciiMode(options?: { override?: boolean; env?: Env; encoding?: string }): boolean;

/** The colour precedence: `flag`, NO_COLOR, FORCE_COLOR, then `isTTY` (default: stdout) and TERM.
 *  Truecolor only with `truecolor: true` and COLORTERM truecolor or 24bit. */
export declare function colorMode(options?: { flag?: boolean; env?: Env; isTTY?: boolean; truecolor?: boolean }): ColorMode;

/** `text` in `role`'s colour for `mode`; "none" and empty text return it unchanged. Throws RangeError on an unknown role or mode. */
export declare function paint(text: string, role: Role, mode?: ColorMode): string;

/** The --version line `sonda/lab <name> <version>`, slash in prompt, cut at LAYOUT.maxWidth. */
export declare function lockup(name: string, version: string, mode?: ColorMode): string;

/** One step-list line. `glyph` is a GLYPHS key or a spinner frame; the label is cut, never wrapped; `mode` paints the glyph. */
export declare function stepLine(
  glyph: GlyphName | string,
  label: string,
  detail?: string,
  options?: { ascii?: boolean; mode?: ColorMode },
): string;

/** The TUI header for an interactive launch, newline-terminated; "" for `machine`, a non-TTY stdout or accessible mode. */
export declare function header(
  name: string,
  version: string,
  description: string,
  options?: { compact?: boolean; machine?: boolean; env?: Env; isTTY?: boolean },
): string;

/** The burst spinner's frame at tick `i`. */
export declare function spinnerFrame(i: number, options?: { ascii?: boolean }): string;

/** The progress continuation line: bar, count, percent. Integers; total <= 0 throws RangeError. */
export declare function progressBar(done: number, total: number, options?: { ascii?: boolean }): string;

/** The decode's frames for `value`; the last is `value`. `rng.choice` picks each unsettled character. */
export declare function decodeFrames(value: string, rng: { choice(pool: readonly string[]): string }, options?: { ascii?: boolean }): string[];

/** `Summary  1 ok · 1 fixed · 1 warn · 1 failed`. */
export declare function summary(ok: number, fixed: number, warn: number, failed: number, options?: { mode?: ColorMode; ascii?: boolean }): string;

/** The prose width: COLUMNS, then stdout's columns, capped at LAYOUT.maxWidth. */
export declare function width(env?: Env): number;

/** Prose wrapped at width(env), words kept whole, each line `indent` spaces in. */
export declare function wrap(text: string, options?: { env?: Env; indent?: number }): string;

/** The error block: `✗ what`, why in dim (wrapped), `Try: fix` (and ` · link`). No trailing newline. */
export declare function errorBlock(
  what: string,
  why?: string,
  fix?: string,
  options?: { link?: string; env?: Env; ascii?: boolean; mode?: ColorMode },
): string;

/** `    Next: <command>`, `Next:` in dim. */
export declare function nextLine(command: string, options?: { mode?: ColorMode }): string;

/** The movement keys for a key hint: `↑↓`, or `up/dn` in ASCII. */
export declare function arrows(options?: { ascii?: boolean }): string;

/** The full-screen footer: `key verb` pairs joined by the separator. */
export declare function keyHints(pairs: Iterable<readonly [string, string]>, options?: { ascii?: boolean; mode?: ColorMode }): string;

/** A section heading: uppercase, in dim. */
export declare function heading(text: string, options?: { mode?: ColorMode }): string;

/** A key-value report line, lined up with step details. Uncoloured. */
export declare function kvLine(key: string, value: string): string;

/** A `[y/N]` answer: true, false, or null when not recognised; empty takes `dflt`. */
export declare function parseYesNo(answer: string, dflt: boolean): boolean | null;

/** A numbered-list answer: the 0-based index, or null. */
export declare function parseChoice(answer: string, count: number): number | null;

/** True when the caller must prompt; throws MissingFlag when stdin is not a TTY and `flag` was not given. */
export declare function needsPrompt(flag: string, options: { given: boolean; what?: string; command?: string; isTTY?: boolean }): boolean;

interface PromptOptions {
  /** Default process.stdin. Each call reads through its own readline interface. */
  input?: { on(event: string, listener: (...args: any[]) => void): unknown };
  /** Default process.stderr; its isTTY decides the colour when `mode` is omitted. */
  output?: { write(chunk: string): unknown; isTTY?: boolean };
  env?: Env;
  mode?: ColorMode;
}

/** Ask `? <question> [y/N] `; up to ROBUSTNESS.promptRetries tries, then NoValidAnswer; end of input rejects at once. */
export declare function confirm(question: string, options?: PromptOptions & { default?: boolean }): Promise<boolean>;

/** The numbered-list question; resolves to the 0-based index. */
export declare function choose(question: string, options: readonly string[], prompt?: PromptOptions): Promise<number>;

/** A failure reported as the spec's three-line error block. */
export declare class TermError extends Error {
  constructor(what: string, why?: string, fix?: string);
  readonly what: string;
  readonly why: string;
  readonly fix: string;
  block(options?: { env?: Env; ascii?: boolean; mode?: ColorMode }): string;
}

/** A prompt got no valid answer: retries ran out or input ended. */
export declare class NoValidAnswer extends TermError {
  constructor(question: string, why: string);
  readonly question: string;
}

/** stdin is not a TTY and `flag` was not passed. */
export declare class MissingFlag extends TermError {
  constructor(flag: string, what?: string, command?: string);
  readonly flag: string;
}
