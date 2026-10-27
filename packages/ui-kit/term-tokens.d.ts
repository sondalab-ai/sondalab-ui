// GENERATED from sondalab.tokens.json by scripts/gen-term-js.mjs — do not edit.

/** A terminal colour role. */
export type Role = "prompt" | "ok" | "warn" | "err" | "dim" | "accent";

/** A GLYPHS key. */
export type GlyphName = "done" | "fixed" | "failed" | "warn" | "active" | "pending" | "skipped" | "question" | "separator";

/** role -> SGR foreground parameters: ansi16 (the named-ANSI floor) and truecolor (the brand hue) */
export declare const ROLES: { readonly [R in Role]: { readonly ansi16: string; readonly truecolor: string } };

/** name -> unicode, ascii and role; ascii on a non-UTF-8 locale, TERM=dumb or SONDALAB_ASCII=1 */
export declare const GLYPHS: { readonly [G in GlyphName]: { readonly unicode: string; readonly ascii: string; readonly role: Role } };

/** layout integers: indent, labelWidth, blankBeforeSummary, maxWidth */
export declare const LAYOUT: {
  readonly indent: number;
  readonly labelWidth: number;
  readonly blankBeforeSummary: number;
  readonly maxWidth: number;
};

/** dither ramp, lightest to darkest; ascii[i] is the fallback for unicode[i] */
export declare const RAMP: {
  readonly unicode: readonly string[];
  readonly ascii: readonly string[];
};

/** burst spinner: frames (unicode) / ascii, one column wide, painted in role */
export declare const SPINNER: {
  readonly frames: readonly string[];
  readonly ascii: readonly string[];
  readonly intervalMs: number;
  readonly delayMs: number;
  readonly role: string;
};

/** decode effect: glyphs plus printable ASCII in randomAscii (inclusive code points) */
export declare const DECODE: {
  readonly glyphs: readonly string[];
  readonly randomAscii: readonly number[];
  readonly frames: number;
  readonly frameMs: number;
};

/** progress bar: cell count, role, percent column width */
export declare const PROGRESS: {
  readonly cells: number;
  readonly role: string;
  readonly percentWidth: number;
};

/** redraw cap and first-output budget */
export declare const MOTION: {
  readonly maxFps: number;
  readonly firstOutputMs: number;
};

/** name -> unicode, ascii: rounded light box drawing and the selection seam */
export declare const BOX: {
  readonly topLeft: {
    readonly unicode: string;
    readonly ascii: string;
  };
  readonly topRight: {
    readonly unicode: string;
    readonly ascii: string;
  };
  readonly bottomLeft: {
    readonly unicode: string;
    readonly ascii: string;
  };
  readonly bottomRight: {
    readonly unicode: string;
    readonly ascii: string;
  };
  readonly horizontal: {
    readonly unicode: string;
    readonly ascii: string;
  };
  readonly vertical: {
    readonly unicode: string;
    readonly ascii: string;
  };
  readonly seam: {
    readonly unicode: string;
    readonly ascii: string;
  };
};

/** name -> unicode, ascii: key names in hints */
export declare const KEYS: {
  readonly up: {
    readonly unicode: string;
    readonly ascii: string;
  };
  readonly down: {
    readonly unicode: string;
    readonly ascii: string;
  };
};

/** OSC 11 timeout and prompt retry cap */
export declare const ROBUSTNESS: {
  readonly osc11TimeoutMs: number;
  readonly promptRetries: number;
};

/** setting -> the environment variables that control it */
export declare const ENV: {
  readonly reducedMotion: readonly string[];
  readonly accessible: readonly string[];
  readonly noColor: readonly string[];
  readonly forceColor: readonly string[];
  readonly ci: readonly string[];
  readonly term: readonly string[];
  readonly colorTerm: readonly string[];
  readonly ascii: readonly string[];
};

/** TUI header: mark rows, accent mask ("a" paints accentRole), compact mark, columns between mark and text */
export declare const HEADER: {
  readonly mark: readonly string[];
  readonly markAccent: readonly string[];
  readonly compact: string;
  readonly compactAccent: string;
  readonly accentRole: string;
  readonly gap: number;
};
