/**
 * Connector creation utilities.
 * Maps Mermaid edge types to FigJam connector styles.
 *
 * Uses ELBOWED connectors for clean right-angle paths.
 */

import type { MermaidEdge } from "./layout";

export interface ConnectorStyle {
  lineType: "ELBOWED" | "STRAIGHT" | "CURVED";
  strokeCap: "NONE" | "ARROW_EQUILATERAL" | "TRIANGLE_FILLED";
  dashPattern: number[];
  strokeWeight: number;
}

/**
 * Map a Mermaid edge type to FigJam connector styling.
 */
export function getConnectorStyle(edgeType: MermaidEdge["type"]): ConnectorStyle {
  switch (edgeType) {
    case "arrow":
      // --> solid line with arrow
      return {
        lineType: "ELBOWED",
        strokeCap: "TRIANGLE_FILLED",
        dashPattern: [],
        strokeWeight: 2,
      };

    case "open":
      // --- solid line, no arrow
      return {
        lineType: "ELBOWED",
        strokeCap: "NONE",
        dashPattern: [],
        strokeWeight: 2,
      };

    case "dotted":
      // -.-> dotted line with arrow
      return {
        lineType: "ELBOWED",
        strokeCap: "TRIANGLE_FILLED",
        dashPattern: [8, 4],
        strokeWeight: 2,
      };

    case "thick":
      // ==> thick line with arrow
      return {
        lineType: "ELBOWED",
        strokeCap: "TRIANGLE_FILLED",
        dashPattern: [],
        strokeWeight: 4,
      };

    default:
      return {
        lineType: "ELBOWED",
        strokeCap: "TRIANGLE_FILLED",
        dashPattern: [],
        strokeWeight: 2,
      };
  }
}
