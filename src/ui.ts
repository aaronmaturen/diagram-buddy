/**
 * UI iframe code.
 * Uses Mermaid's internal parser + renderer to extract graph data.
 * No regex edge parsing — Mermaid does all the parsing.
 */

import mermaid from "mermaid";

const input = document.getElementById("mermaid-input") as HTMLTextAreaElement;
const generateBtn = document.getElementById("generate-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;
const loadExampleBtn = document.getElementById("load-example") as HTMLSpanElement;

const EXAMPLE = `flowchart TD
    A[Start] --> B{Is it valid?}
    B -->|Yes| C[Process data]
    B -->|No| D[Show error]
    C --> E[Save results]
    D --> F[Log error]
    E --> G((End))
    F --> G`;

mermaid.initialize({
  startOnLoad: false,
  flowchart: { htmlLabels: true, useMaxWidth: false },
});

function setStatus(msg: string, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "status error" : "status";
}

loadExampleBtn.addEventListener("click", () => {
  input.value = EXAMPLE;
  input.focus();
});

generateBtn.addEventListener("click", async () => {
  const source = input.value.trim();
  if (!source) {
    setStatus("Please enter Mermaid syntax.", true);
    return;
  }

  generateBtn.disabled = true;
  setStatus("Parsing...");

  try {
    // Split input into separate diagrams on flowchart/graph boundaries
    const diagrams = splitDiagrams(source);
    const graphs: ParsedGraph[] = [];

    for (let i = 0; i < diagrams.length; i++) {
      setStatus(`Parsing diagram ${i + 1} of ${diagrams.length}...`);
      const graphData = await parseAndExtract(diagrams[i]);
      graphs.push(graphData);
    }

    parent.postMessage(
      { pluginMessage: { type: "generate-multi", graphs: graphs } },
      "*"
    );
    setStatus("Generating diagrams...");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Parse error: ${msg}`, true);
    generateBtn.disabled = false;
  }
});

window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;
  if (msg.type === "done") {
    setStatus(`Created ${msg.nodeCount} shapes and ${msg.edgeCount} connectors.`);
    generateBtn.disabled = false;
  }
  if (msg.type === "error") {
    setStatus(msg.message, true);
    generateBtn.disabled = false;
  }
};

/**
 * Split a multi-diagram input into separate Mermaid diagram strings.
 * Splits on lines that start with 'flowchart' or 'graph' keywords.
 */
function splitDiagrams(source: string): string[] {
  const lines = source.split("\n");
  const diagrams: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // New diagram starts with flowchart or graph keyword
    if (/^(flowchart|graph)\s/i.test(trimmed) && current.length > 0) {
      // Save previous diagram
      const diagramText = current.join("\n").trim();
      if (diagramText) diagrams.push(diagramText);
      current = [];
    }
    current.push(line);
  }

  // Don't forget the last diagram
  const lastDiagram = current.join("\n").trim();
  if (lastDiagram) diagrams.push(lastDiagram);

  return diagrams;
}

// ─── Types ───

interface ParsedNode {
  id: string;
  label: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
}

interface ParsedEdge {
  source: string;
  target: string;
  label: string;
  type: "arrow" | "open" | "dotted" | "thick";
}

interface SubgraphInfo {
  id: string;
  title: string;
  nodeIds: string[];
}

interface ParsedGraph {
  direction: "TD" | "LR" | "BT" | "RL";
  nodes: ParsedNode[];
  edges: ParsedEdge[];
  subgraphs: SubgraphInfo[];
}

// ─── Main extraction using Mermaid's internal APIs ───

async function parseAndExtract(source: string): Promise<ParsedGraph> {
  // Step 1: Use Mermaid's parser to get the diagram object
  const diagram = await (mermaid as any).mermaidAPI.getDiagramFromText(source);
  const db = diagram.db;

  // Extract direction
  let direction: ParsedGraph["direction"] = "TD";
  if (typeof db.getDirection === "function") {
    const dir = (db.getDirection() || "TD").toUpperCase();
    if (dir === "TB") direction = "TD";
    else if (["TD", "LR", "BT", "RL"].includes(dir)) direction = dir as any;
  }

  // Extract vertices, edges, subgraphs from Mermaid's parser
  const verticesRaw = typeof db.getVertices === "function" ? db.getVertices() : {};
  const mermaidEdges = typeof db.getEdges === "function" ? db.getEdges() : [];
  const mermaidSubGraphs = typeof db.getSubGraphs === "function" ? db.getSubGraphs() : [];

  // Normalize vertices to a Map
  const vertexMap: Map<string, any> =
    verticesRaw instanceof Map ? verticesRaw : new Map(Object.entries(verticesRaw));

  // Build subgraph info
  const subgraphs: SubgraphInfo[] = [];
  const subgraphIds = new Set<string>();

  for (const sg of mermaidSubGraphs) {
    const id = sg.id || "";
    const title = sg.title || sg.labelText || sg.label || id;
    const nodeIds: string[] = sg.nodes || [];
    subgraphs.push({ id, title, nodeIds });
    subgraphIds.add(id);
  }

  // Extract styles from Mermaid's parser
  // db.getClasses() returns classDef styles, but inline `style X fill:...` 
  // are stored differently. Let's also check the vertex/subgraph objects for styles.
  const classes = typeof db.getClasses === "function" ? db.getClasses() : {};
  
  // Parse inline style directives from source text
  const nodeStyles: { [id: string]: { fill?: string; stroke?: string } } = {};
  const styleLines = source.split("\n").filter((l: string) => l.trim().startsWith("style "));
  for (const line of styleLines) {
    const match = line.trim().match(/^style\s+([\w-]+)\s+(.+)$/);
    if (match) {
      const id = match[1];
      const styleStr = match[2];
      const styles: { fill?: string; stroke?: string } = {};
      
      const fillMatch = styleStr.match(/fill:\s*([^,;\s]+)/);
      if (fillMatch) styles.fill = fillMatch[1];
      
      const strokeMatch = styleStr.match(/stroke:\s*([^,;\s]+)/);
      if (strokeMatch) styles.stroke = strokeMatch[1];
      
      if (styles.fill || styles.stroke) {
        nodeStyles[id] = styles;
      }
    }
  }

  console.log("[figma-mermaid] Node styles:", nodeStyles);
  console.log("[figma-mermaid] Vertices:", vertexMap.size, "Edges:", mermaidEdges.length, "Subgraphs:", subgraphs.length);

  // Step 2: Render to SVG to get layout positions
  const existing = document.getElementById("mermaid-render-container");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "mermaid-render-container";
  container.style.cssText =
    "position:fixed; top:0; left:0; width:4000px; height:4000px; overflow:hidden; opacity:0; pointer-events:none; z-index:-1;";
  document.body.appendChild(container);

  let svgEl: SVGSVGElement;
  try {
    const { svg } = await mermaid.render("mermaid-diagram", source);
    container.innerHTML = svg;
    svgEl = container.querySelector("svg")!;
    if (!svgEl) throw new Error("Mermaid did not produce SVG output");
  } catch (err) {
    container.remove();
    throw err;
  }

  const svgRect = svgEl.getBoundingClientRect();

  // Step 3: Extract positions for nodes from SVG
  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  svgEl.querySelectorAll(".node").forEach((el) => {
    const rawId = el.id || "";
    const cleanId = rawId.replace(/^flowchart-/, "").replace(/-\d+$/, "");
    if (!cleanId) return;

    const elRect = el.getBoundingClientRect();
    if (elRect.width < 1 || elRect.height < 1) return;

    nodePositions.set(cleanId, {
      x: elRect.left - svgRect.left,
      y: elRect.top - svgRect.top,
      width: elRect.width,
      height: elRect.height,
    });
  });

  // Step 4: Extract positions for subgraphs from SVG
  const subgraphPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  svgEl.querySelectorAll(".cluster").forEach((el) => {
    const rawId = el.id || "";
    // Mermaid names clusters like "flowchart-Before-123" or just the ID
    const cleanId = rawId.replace(/^flowchart-/, "").replace(/-\d+$/, "");
    if (!cleanId) return;

    const elRect = el.getBoundingClientRect();
    if (elRect.width < 1 || elRect.height < 1) return;

    subgraphPositions.set(cleanId, {
      x: elRect.left - svgRect.left,
      y: elRect.top - svgRect.top,
      width: elRect.width,
      height: elRect.height,
    });
  });

  container.remove();

  // Step 5: Build nodes from vertices + SVG positions
  const nodes: ParsedNode[] = [];

  vertexMap.forEach((vertex: any, id: string) => {
    // Skip subgraph IDs — they're containers, not nodes
    if (subgraphIds.has(id)) return;

    const pos = nodePositions.get(id);
    if (!pos) {
      console.log("[figma-mermaid] No SVG position for vertex:", id);
      return;
    }

    const label = vertex.labelText || vertex.text || vertex.label || id;
    const shape = vertex.type || vertex.shape || "rect";
    const styles = nodeStyles[id];

    nodes.push({
      id,
      label: String(label),
      shape: String(shape),
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      fill: styles?.fill,
      stroke: styles?.stroke,
    });
  });

  // Add subgraphs as nodes too (rendered as sections/rectangles)
  for (const sg of subgraphs) {
    const pos = subgraphPositions.get(sg.id);
    if (!pos) {
      console.log("[figma-mermaid] No SVG position for subgraph:", sg.id);
      continue;
    }

    const sgStyles = nodeStyles[sg.id];
    nodes.push({
      id: sg.id,
      label: sg.title,
      shape: "subgraph",
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      fill: sgStyles?.fill,
      stroke: sgStyles?.stroke,
    });
  }

  // Step 6: Build edges from Mermaid's parsed edges
  const edges: ParsedEdge[] = [];

  for (const edge of mermaidEdges) {
    const source = edge.start || edge.src || "";
    const target = edge.end || edge.dst || "";
    if (!source || !target) continue;

    let label = edge.labelText || edge.text || "";
    if (typeof label !== "string") label = "";

    let type: ParsedEdge["type"] = "arrow";
    const stroke = (edge.stroke || edge.type || "").toLowerCase();
    if (stroke.includes("dotted")) type = "dotted";
    else if (stroke.includes("thick")) type = "thick";

    edges.push({ source, target, label, type });
  }

  console.log("[figma-mermaid] Final nodes:", nodes.length, "(incl", subgraphs.length, "subgraphs)");
  console.log("[figma-mermaid] Final edges:", edges.length);
  console.log("[figma-mermaid] Nodes:", JSON.stringify(nodes, null, 2));
  console.log("[figma-mermaid] Edges:", JSON.stringify(edges, null, 2));

  return { direction, nodes, edges, subgraphs };
}
