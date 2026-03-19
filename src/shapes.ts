/**
 * Mermaid shape → FigJam shapeType mapping.
 *
 * Returns the native FigJam ShapeWithTextNode.shapeType for a given
 * Mermaid shape identifier, or null if the shape needs SVG fallback.
 */

type FigJamShapeType =
  | "SQUARE"
  | "ELLIPSE"
  | "ROUNDED_RECTANGLE"
  | "DIAMOND"
  | "TRIANGLE_UP"
  | "TRIANGLE_DOWN"
  | "PARALLELOGRAM_RIGHT"
  | "PARALLELOGRAM_LEFT"
  | "ENG_DATABASE"
  | "ENG_QUEUE"
  | "ENG_FILE"
  | "ENG_FOLDER"
  | "TRAPEZOID"
  | "PREDEFINED_PROCESS"
  | "SHIELD"
  | "DOCUMENT_SINGLE"
  | "DOCUMENT_MULTIPLE"
  | "MANUAL_INPUT"
  | "HEXAGON"
  | "CHEVRON"
  | "PENTAGON"
  | "OCTAGON"
  | "STAR"
  | "PLUS"
  | "ARROW_LEFT"
  | "ARROW_RIGHT"
  | "SUMMING_JUNCTION"
  | "OR"
  | "SPEECH_BUBBLE"
  | "INTERNAL_STORAGE";

export interface ShapeMapping {
  figjamType: FigJamShapeType | null;
  svgFallback: boolean;
}

/**
 * Maps Mermaid's internal shape identifiers to FigJam shape types.
 *
 * Mermaid uses two naming systems:
 * - Classic bracket syntax parsed into shape names (e.g., "round", "diamond")
 * - New @{ shape: "..." } syntax with semantic names (e.g., "rect", "cyl")
 *
 * This map normalizes both.
 */
const SHAPE_MAP: Record<string, ShapeMapping> = {
  // === Classic bracket syntax shapes ===

  // [text] — rectangle
  square: { figjamType: "SQUARE", svgFallback: false },
  rect: { figjamType: "SQUARE", svgFallback: false },

  // (text) — rounded rectangle
  round: { figjamType: "ROUNDED_RECTANGLE", svgFallback: false },
  rounded: { figjamType: "ROUNDED_RECTANGLE", svgFallback: false },

  // ([text]) — stadium
  stadium: { figjamType: "ROUNDED_RECTANGLE", svgFallback: false },

  // {text} — diamond
  diamond: { figjamType: "DIAMOND", svgFallback: false },
  question: { figjamType: "DIAMOND", svgFallback: false },

  // ((text)) — circle
  circle: { figjamType: "ELLIPSE", svgFallback: false },

  // (((text))) — double circle
  "double-circle": { figjamType: "ELLIPSE", svgFallback: false },
  "dbl-circ": { figjamType: "ELLIPSE", svgFallback: false },
  doublecircle: { figjamType: "ELLIPSE", svgFallback: false },

  // {{text}} — hexagon
  hexagon: { figjamType: "HEXAGON", svgFallback: false },

  // [[text]] — subroutine
  subroutine: { figjamType: "PREDEFINED_PROCESS", svgFallback: false },
  subproc: { figjamType: "PREDEFINED_PROCESS", svgFallback: false },

  // [(text)] — cylinder / database
  cylinder: { figjamType: "ENG_DATABASE", svgFallback: false },
  cyl: { figjamType: "ENG_DATABASE", svgFallback: false },

  // >text] — asymmetric / flag-like
  asymmetric: { figjamType: "ARROW_RIGHT", svgFallback: false },
  odd: { figjamType: "ARROW_RIGHT", svgFallback: false },

  // [/text/] — parallelogram (lean right)
  "lean-right": { figjamType: "PARALLELOGRAM_RIGHT", svgFallback: false },
  "lean_right": { figjamType: "PARALLELOGRAM_RIGHT", svgFallback: false },
  "lean-r": { figjamType: "PARALLELOGRAM_RIGHT", svgFallback: false },

  // [\text\] — parallelogram (lean left)
  "lean-left": { figjamType: "PARALLELOGRAM_LEFT", svgFallback: false },
  "lean_left": { figjamType: "PARALLELOGRAM_LEFT", svgFallback: false },
  "lean-l": { figjamType: "PARALLELOGRAM_LEFT", svgFallback: false },

  // [/text\] — trapezoid
  trapezoid: { figjamType: "TRAPEZOID", svgFallback: false },
  trap: { figjamType: "TRAPEZOID", svgFallback: false },

  // [\text/] — inverted trapezoid
  "inv-trapezoid": { figjamType: "TRAPEZOID", svgFallback: false },
  "inv-trap": { figjamType: "TRAPEZOID", svgFallback: false },
  "trapezoid-alt": { figjamType: "TRAPEZOID", svgFallback: false },

  // === New @{ shape } syntax shapes ===

  // Circles
  "sm-circ": { figjamType: "ELLIPSE", svgFallback: false },
  "framed-circle": { figjamType: "ELLIPSE", svgFallback: false },
  "f-circ": { figjamType: "ELLIPSE", svgFallback: false },
  "cross-circ": { figjamType: "SUMMING_JUNCTION", svgFallback: false },

  // Triangles
  tri: { figjamType: "TRIANGLE_UP", svgFallback: false },
  "flip-tri": { figjamType: "TRIANGLE_DOWN", svgFallback: false },

  // Documents
  doc: { figjamType: "DOCUMENT_SINGLE", svgFallback: false },
  docs: { figjamType: "DOCUMENT_MULTIPLE", svgFallback: false },

  // Manual input
  "sl-rect": { figjamType: "MANUAL_INPUT", svgFallback: false },
  "manual-input": { figjamType: "MANUAL_INPUT", svgFallback: false },

  // Multi-process
  processes: { figjamType: "INTERNAL_STORAGE", svgFallback: false },
  procs: { figjamType: "INTERNAL_STORAGE", svgFallback: false },

  // Direct access storage (horizontal cylinder)
  das: { figjamType: "ENG_QUEUE", svgFallback: false },

  // Loop limit
  "notch-pent": { figjamType: "PENTAGON", svgFallback: false },

  // Text block — handled specially as a TextNode, not ShapeWithText
  text: { figjamType: null, svgFallback: false },

  // === SVG fallback shapes ===
  fork: { figjamType: null, svgFallback: true },
  "notch-rect": { figjamType: null, svgFallback: true },
  "tag-rect": { figjamType: null, svgFallback: true },
  "bow-rect": { figjamType: null, svgFallback: true },
  "div-rect": { figjamType: null, svgFallback: true },
  "lin-rect": { figjamType: null, svgFallback: true },
  "lin-cyl": { figjamType: null, svgFallback: true },
  "lin-doc": { figjamType: null, svgFallback: true },
  "curv-trap": { figjamType: null, svgFallback: true },
  flag: { figjamType: null, svgFallback: true },
  "manual-file": { figjamType: null, svgFallback: true },
  "paper-tape": { figjamType: null, svgFallback: true },
};

/** Default shape when Mermaid shape is unknown */
const DEFAULT_MAPPING: ShapeMapping = {
  figjamType: "ROUNDED_RECTANGLE",
  svgFallback: false,
};

/**
 * Look up the FigJam shape mapping for a Mermaid shape identifier.
 */
export function getShapeMapping(mermaidShape: string): ShapeMapping {
  const normalized = mermaidShape.toLowerCase().trim();
  return SHAPE_MAP[normalized] ?? DEFAULT_MAPPING;
}

/**
 * Check if a Mermaid shape needs SVG fallback rendering.
 */
export function needsSvgFallback(mermaidShape: string): boolean {
  return getShapeMapping(mermaidShape).svgFallback;
}

export type { FigJamShapeType };
