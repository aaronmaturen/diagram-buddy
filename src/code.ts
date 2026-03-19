/**
 * Plugin sandbox code.
 * Runs in Figma's QuickJS sandbox — has access to figma.* API.
 * Receives parsed graph data from the UI iframe via postMessage.
 */

import { getShapeMapping } from "./shapes";
import { getConnectorStyle } from "./connectors";
import { processLabel } from "./labels";
import type { MermaidEdge } from "./layout";

interface IncomingNode {
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

/**
 * Parse a CSS hex color (#rgb or #rrggbb) into Figma RGB (0-1 range).
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  var clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length !== 6) return null;
  var num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

interface IncomingSubgraph {
  id: string;
  title: string;
  nodeIds: string[];
}

interface IncomingGraph {
  direction: "TD" | "LR" | "BT" | "RL";
  nodes: IncomingNode[];
  subgraphs: IncomingSubgraph[];
  edges: MermaidEdge[];
}

figma.showUI(__html__, { width: 420, height: 500 });

figma.ui.onmessage = async (msg: any) => {
  if (msg.type === "generate") {
    try {
      await generateDiagram(msg.graph, 0);
    } catch (err) {
      var message = err instanceof Error ? err.message : String(err);
      figma.ui.postMessage({ type: "error", message: message });
      figma.notify("Error: " + message, { error: true });
    }
  }

  if (msg.type === "generate-multi") {
    try {
      await generateMultipleDiagrams(msg.graphs);
    } catch (err) {
      var message = err instanceof Error ? err.message : String(err);
      figma.ui.postMessage({ type: "error", message: message });
      figma.notify("Error: " + message, { error: true });
    }
  }
};

/**
 * Estimate text dimensions for sizing shapes.
 */
function estimateTextSize(text: string, fontSize: number): { width: number; height: number } {
  var lines = text.split("\n");
  // IBM Plex Mono is wider than Inter — use 0.65 char width ratio
  var charWidth = fontSize * 0.65;
  var lineHeight = fontSize * 1.6;
  var maxLen = 0;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].length > maxLen) maxLen = lines[i].length;
  }
  return {
    width: maxLen * charWidth + 56,
    height: lines.length * lineHeight + 44,
  };
}

/**
 * Choose connector magnets based on graph direction and relative positions.
 */
function chooseMagnets(
  source: SceneNode,
  target: SceneNode,
  direction: string
): { start: string; end: string } {
  var sx = source.x + source.width / 2;
  var sy = source.y + source.height / 2;
  var tx = target.x + target.width / 2;
  var ty = target.y + target.height / 2;

  var dx = tx - sx;
  var dy = ty - sy;
  var absDx = Math.abs(dx);
  var absDy = Math.abs(dy);

  var isVerticalFlow = direction === "TD" || direction === "BT";

  if (isVerticalFlow) {
    if (absDy > absDx * 0.3) {
      if (dy > 0) return { start: "BOTTOM", end: "TOP" };
      return { start: "TOP", end: "BOTTOM" };
    }
    if (dx > 0) return { start: "RIGHT", end: "LEFT" };
    return { start: "LEFT", end: "RIGHT" };
  } else {
    if (absDx > absDy * 0.3) {
      if (dx > 0) return { start: "RIGHT", end: "LEFT" };
      return { start: "LEFT", end: "RIGHT" };
    }
    if (dy > 0) return { start: "BOTTOM", end: "TOP" };
    return { start: "TOP", end: "BOTTOM" };
  }
}

/**
 * Main diagram generation.
 */
/**
 * Generate multiple diagrams, stacked vertically with spacing.
 */
async function generateMultipleDiagrams(graphs: IncomingGraph[]) {
  var totalNodes = 0;
  var totalEdges = 0;
  var wrappers: SectionNode[] = [];

  for (var i = 0; i < graphs.length; i++) {
    var result = await generateDiagram(graphs[i], i);
    totalNodes += result.nodeCount;
    totalEdges += result.edgeCount;
    if (result.wrapper) wrappers.push(result.wrapper);
  }

  // Stack wrappers vertically with spacing
  if (wrappers.length > 1) {
    var currentY = wrappers[0].y;
    for (var i = 0; i < wrappers.length; i++) {
      wrappers[i].y = currentY;
      currentY += wrappers[i].height + 120;
    }
  }

  if (wrappers.length > 0) {
    figma.currentPage.selection = wrappers;
    figma.viewport.scrollAndZoomIntoView(wrappers);
  }

  figma.ui.postMessage({
    type: "done",
    nodeCount: totalNodes,
    edgeCount: totalEdges,
  });

  figma.notify(
    "Created " + graphs.length + " diagrams with " + totalNodes + " shapes and " + totalEdges + " connectors."
  );
}

async function generateDiagram(rawGraph: IncomingGraph, diagramIndex: number): Promise<{ nodeCount: number; edgeCount: number; wrapper: SectionNode | null }> {
  // Load fonts we'll need
  // FigJam "Technical" style uses IBM Plex Mono
  // FigJam "Simple" style uses Inter
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "IBM Plex Mono", style: "Medium" });
  await figma.loadFontAsync({ family: "IBM Plex Mono", style: "Regular" });

  var SHAPE_FONT: FontName = { family: "IBM Plex Mono", style: "Medium" };
  var SHAPE_FONT_SIZE = 24;
  var TEXT_FONT: FontName = { family: "IBM Plex Mono", style: "Regular" };
  var TEXT_FONT_SIZE = 20;

  // Default pastel palette for sections without explicit style colors
  var SECTION_PALETTE = [
    { r: 0.85, g: 0.92, b: 1.0 },   // light blue
    { r: 0.91, g: 0.96, b: 0.87 },   // light green
    { r: 1.0,  g: 0.95, b: 0.85 },   // light orange
    { r: 0.95, g: 0.88, b: 0.96 },   // light purple
    { r: 1.0,  g: 0.93, b: 0.88 },   // light peach
    { r: 0.88, g: 0.95, b: 0.95 },   // light teal
    { r: 0.96, g: 0.93, b: 0.85 },   // light tan
    { r: 0.93, g: 0.88, b: 0.93 },   // light mauve
  ];
  var sectionColorIndex = 0;

  var nodes = rawGraph.nodes;
  var edges = rawGraph.edges;

  // Scale factor from Mermaid SVG coordinates to FigJam
  var SCALE = 2.5;

  // Place near viewport center
  var viewCenter = figma.viewport.center;
  var offsetX = viewCenter.x - 500;
  var offsetY = viewCenter.y - 300;

  // Track created FigJam nodes by Mermaid ID
  var nodeMap: { [key: string]: SceneNode } = {};

  // --- Create subgraphs first (as Sections) ---
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.shape !== "subgraph") continue;

    var label = processLabel(node.label);
    var x = node.x * SCALE + offsetX;
    var y = node.y * SCALE + offsetY;
    var w = Math.max(node.width * SCALE, 200);
    var h = Math.max(node.height * SCALE, 150);

    var section = figma.createSection();
    section.name = label;
    section.x = x;
    section.y = y;
    section.resizeWithoutConstraints(w, h);

    // Apply fill color: explicit style > default palette
    if (node.fill) {
      var fillRgb = hexToRgb(node.fill);
      if (fillRgb) {
        section.fills = [{ type: "SOLID", color: fillRgb }];
      }
    } else {
      // Use default palette color
      var paletteColor = SECTION_PALETTE[sectionColorIndex % SECTION_PALETTE.length];
      section.fills = [{ type: "SOLID", color: paletteColor }];
      sectionColorIndex++;
    }

    nodeMap[node.id] = section;
  }

  // --- Create regular shapes ---
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.shape === "subgraph") continue;

    var label = processLabel(node.label);
    var mapping = getShapeMapping(node.shape);

    // Compute center point from Mermaid's layout (scaled)
    var centerX = (node.x + node.width / 2) * SCALE + offsetX;
    var centerY = (node.y + node.height / 2) * SCALE + offsetY;

    // Size: max of Mermaid's computed size and our text estimate
    var textSize = estimateTextSize(label, SHAPE_FONT_SIZE);
    var w = Math.max(node.width * SCALE, textSize.width, 140);
    var h = Math.max(node.height * SCALE, textSize.height, 60);

    // Position from center so shapes stay aligned on Mermaid's grid
    var x = centerX - w / 2;
    var y = centerY - h / 2;

    if (node.shape === "text") {
      // Plain text node
      var textNode = figma.createText();
      textNode.x = x;
      textNode.y = y;
      textNode.fontName = TEXT_FONT;
      textNode.characters = label;
      textNode.fontSize = TEXT_FONT_SIZE;
      nodeMap[node.id] = textNode;
    } else {
      // Shape with text
      var shapeType = mapping.figjamType || "ROUNDED_RECTANGLE";
      var shape = figma.createShapeWithText();
      shape.shapeType = shapeType as any;
      shape.x = x;
      shape.y = y;
      shape.resize(w, h);

      // Load whatever font the shape currently has, then switch to our font
      try {
        var currentFont = shape.text.fontName;
        if (currentFont && typeof currentFont === "object" && currentFont.family) {
          await figma.loadFontAsync(currentFont as FontName);
        }
      } catch (_e) {
        // ignore
      }
      shape.text.fontName = SHAPE_FONT;
      shape.text.fontSize = SHAPE_FONT_SIZE;
      shape.text.characters = label;

      // Apply colors: style directive > SVG fallback tint > default
      if (node.fill) {
        var fillRgb = hexToRgb(node.fill);
        if (fillRgb) {
          shape.fills = [{ type: "SOLID", color: fillRgb }];
        }
      } else if (mapping.svgFallback) {
        shape.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.92, b: 1.0 } }];
      }

      if (node.stroke) {
        var strokeRgb = hexToRgb(node.stroke);
        if (strokeRgb) {
          shape.strokes = [{ type: "SOLID", color: strokeRgb }];
        }
      }

      nodeMap[node.id] = shape;
    }
  }

  // --- Create connectors ---
  var edgeCount = 0;
  for (var i = 0; i < edges.length; i++) {
    var edge = edges[i];
    var sourceNode = nodeMap[edge.source];
    var targetNode = nodeMap[edge.target];

    if (!sourceNode || !targetNode) {
      console.log("Skipping edge — missing node:", edge.source, "→", edge.target);
      continue;
    }

    var connector = figma.createConnector();

    // Pick magnets based on graph direction and relative position
    var magnets = chooseMagnets(sourceNode, targetNode, rawGraph.direction);
    connector.connectorStart = {
      endpointNodeId: sourceNode.id,
      magnet: magnets.start as any,
    };
    connector.connectorEnd = {
      endpointNodeId: targetNode.id,
      magnet: magnets.end as any,
    };

    var style = getConnectorStyle(edge.type);
    connector.connectorLineType = style.lineType;
    connector.strokeWeight = style.strokeWeight;
    if (style.dashPattern.length > 0) {
      connector.dashPattern = style.dashPattern;
    }
    connector.connectorStartStrokeCap = "NONE";
    connector.connectorEndStrokeCap = style.strokeCap;

    if (edge.label) {
      var edgeLabel = processLabel(edge.label);
      try {
        if (connector.text) {
          // Load whatever font the connector currently has
          var connFont = connector.text.fontName;
          if (connFont && typeof connFont === "object" && connFont.family) {
            await figma.loadFontAsync(connFont as FontName);
          }
          // Set to our monospace font
          connector.text.fontName = SHAPE_FONT;
          connector.text.fontSize = TEXT_FONT_SIZE;
          connector.text.characters = edgeLabel;
        }
      } catch (e) {
        // Fallback: try setting text with default font
        try {
          if (connector.text) {
            await figma.loadFontAsync({ family: "Inter", style: "Medium" });
            connector.text.characters = edgeLabel;
          }
        } catch (_e2) {
          // Silently skip label if all font loading fails
        }
      }
    }

    edgeCount++;
  }

  // --- Nest nodes into their parent subgraph sections ---
  // Build a parent map: for each node/subgraph ID, find its immediate parent subgraph
  var subgraphs = rawGraph.subgraphs || [];
  var parentMap: { [childId: string]: string } = {};
  var subgraphIds: { [id: string]: boolean } = {};

  for (var s = 0; s < subgraphs.length; s++) {
    subgraphIds[subgraphs[s].id] = true;
  }

  // Mermaid's subgraph.nodeIds lists direct children (both nodes and child subgraphs)
  for (var s = 0; s < subgraphs.length; s++) {
    var sg = subgraphs[s];
    var children = sg.nodeIds || [];
    for (var c = 0; c < children.length; c++) {
      var childId = children[c];
      // Only set parent if the child exists in our nodeMap
      if (nodeMap[childId]) {
        parentMap[childId] = sg.id;
      }
    }
  }

  // Sort subgraphs by depth (innermost first) so we reparent bottom-up
  // A subgraph that is a child of another should be reparented first
  var subgraphOrder: string[] = [];
  var visited: { [id: string]: boolean } = {};

  function visitSubgraph(id: string) {
    if (visited[id]) return;
    visited[id] = true;
    // Visit children first (depth-first)
    for (var s = 0; s < subgraphs.length; s++) {
      var sg = subgraphs[s];
      if (parentMap[sg.id] === id) {
        visitSubgraph(sg.id);
      }
    }
    subgraphOrder.push(id);
  }

  // Start from root subgraphs (those without parents)
  for (var s = 0; s < subgraphs.length; s++) {
    if (!parentMap[subgraphs[s].id]) {
      visitSubgraph(subgraphs[s].id);
    }
  }

  // Reparent: for each subgraph (innermost first), move its children into it
  for (var idx = 0; idx < subgraphOrder.length; idx++) {
    var sgId = subgraphOrder[idx];
    var sectionNode = nodeMap[sgId];
    if (!sectionNode || sectionNode.type !== "SECTION") continue;

    var sectionAsSection = sectionNode as SectionNode;

    // Find all direct children of this subgraph
    for (var childId in parentMap) {
      if (parentMap[childId] !== sgId) continue;
      var childNode = nodeMap[childId];
      if (!childNode) continue;

      // Save absolute position before reparenting
      var absX = childNode.x;
      var absY = childNode.y;

      // Append child into the section
      sectionAsSection.appendChild(childNode);

      // Convert to relative coordinates
      childNode.x = absX - sectionAsSection.x;
      childNode.y = absY - sectionAsSection.y;
    }
  }

  // --- Wrap everything in an outer "Mermaid Diagram" section ---
  // Collect only top-level nodes (those not reparented into a subgraph)
  var topLevelNodes: SceneNode[] = [];
  for (var key in nodeMap) {
    if (!parentMap[key]) {
      topLevelNodes.push(nodeMap[key]);
    }
  }

  var allCreated: SceneNode[] = [];
  for (var key in nodeMap) {
    allCreated.push(nodeMap[key]);
  }

  var wrapperSection: SectionNode | null = null;

  if (topLevelNodes.length > 0) {
    var PADDING = 80;
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    for (var n = 0; n < topLevelNodes.length; n++) {
      var nd = topLevelNodes[n];
      if (nd.x < minX) minX = nd.x;
      if (nd.y < minY) minY = nd.y;
      if (nd.x + nd.width > maxX) maxX = nd.x + nd.width;
      if (nd.y + nd.height > maxY) maxY = nd.y + nd.height;
    }

    wrapperSection = figma.createSection();
    wrapperSection.name = "Diagram Buddy";
    wrapperSection.x = minX - PADDING;
    wrapperSection.y = minY - PADDING;
    wrapperSection.resizeWithoutConstraints(
      maxX - minX + PADDING * 2,
      maxY - minY + PADDING * 2
    );

    for (var n = 0; n < topLevelNodes.length; n++) {
      var nd = topLevelNodes[n];
      var absX = nd.x;
      var absY = nd.y;
      wrapperSection.appendChild(nd);
      nd.x = absX - wrapperSection.x;
      nd.y = absY - wrapperSection.y;
    }
  }

  return { nodeCount: allCreated.length, edgeCount: edgeCount, wrapper: wrapperSection };
}
