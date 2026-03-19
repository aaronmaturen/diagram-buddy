/**
 * Layout utilities.
 * Takes parsed Mermaid graph data and computes FigJam positions.
 */

export interface MermaidNode {
  id: string;
  label: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MermaidEdge {
  source: string;
  target: string;
  label: string;
  type: "arrow" | "open" | "dotted" | "thick";
}

export interface MermaidGraph {
  direction: "TD" | "LR" | "BT" | "RL";
  nodes: MermaidNode[];
  edges: MermaidEdge[];
}

/** Spacing between nodes when doing our own layout */
const NODE_SPACING_X = 250;
const NODE_SPACING_Y = 150;

/**
 * Apply an offset so the diagram is placed near the viewport center.
 * `offsetX` and `offsetY` are the top-left of the placement area.
 */
export function applyOffset(
  graph: MermaidGraph,
  offsetX: number,
  offsetY: number
): MermaidGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      x: node.x + offsetX,
      y: node.y + offsetY,
    })),
  };
}

/**
 * Scale Mermaid's layout coordinates to FigJam-friendly sizes.
 * Mermaid's internal coordinates can be very small or very large
 * depending on the renderer — this normalizes them.
 */
export function scaleLayout(
  graph: MermaidGraph,
  scaleFactor: number = 1.5
): MermaidGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      x: node.x * scaleFactor,
      y: node.y * scaleFactor,
      width: Math.max(node.width * scaleFactor, 120),
      height: Math.max(node.height * scaleFactor, 60),
    })),
  };
}

/**
 * Simple grid layout fallback if Mermaid layout extraction fails.
 * Places nodes in a grid following the graph direction.
 */
export function gridLayout(
  nodes: Array<{ id: string; label: string; shape: string }>,
  edges: MermaidEdge[],
  direction: MermaidGraph["direction"]
): MermaidGraph {
  const isHorizontal = direction === "LR" || direction === "RL";
  const cols = isHorizontal
    ? Math.ceil(Math.sqrt(nodes.length * 2))
    : Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / cols);

  const layoutNodes: MermaidNode[] = nodes.map((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    return {
      ...node,
      x: (isHorizontal ? col : col) * NODE_SPACING_X,
      y: (isHorizontal ? row : row) * NODE_SPACING_Y,
      width: 160,
      height: 80,
    };
  });

  return { direction, nodes: layoutNodes, edges };
}
