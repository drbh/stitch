import React, { useMemo } from "react";

// Function to calculate node positions in a circle
const calculateNodePositions = (nodes, width, height, radius) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const angleStep = (2 * Math.PI) / nodes.length;

  return nodes.reduce((positions, node, index) => {
    const angle = index * angleStep;
    positions[node] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      label: node,
    };
    return positions;
  }, {});
};

// Function to calculate edge paths
const calculateEdgePaths = (edges, nodePositions, nodeRadius) => {
  return edges.map(([source, target]) => {
    const sourcePos = nodePositions[source];
    const targetPos = nodePositions[target];

    // Calculate the angle between nodes to determine where the edge should start/end
    const angle = Math.atan2(
      targetPos.y - sourcePos.y,
      targetPos.x - sourcePos.x
    );

    // Start point: at the edge of source node
    const startX = sourcePos.x + nodeRadius * Math.cos(angle);
    const startY = sourcePos.y + nodeRadius * Math.sin(angle);

    // End point: slightly before the target node (for the arrow to look right)
    const endX = targetPos.x - (nodeRadius + 1) * Math.cos(angle);
    const endY = targetPos.y - (nodeRadius + 1) * Math.sin(angle);

    return {
      source,
      target,
      startX,
      startY,
      endX,
      endY,
    };
  });
};

// The main component
const DirectedGraph = ({ data = dummyData }) => {
  const svgWidth = 600;
  const svgHeight = 400;
  const nodeRadius = 40;
  const circleRadius = Math.min(svgWidth, svgHeight) / 2 - nodeRadius - 20;

  // Calculate node positions and edge paths
  const nodePositions = useMemo(
    () => calculateNodePositions(data.nodes, svgWidth, svgHeight, circleRadius),
    [data.nodes, svgWidth, svgHeight, circleRadius]
  );

  const edgePaths = useMemo(
    () => calculateEdgePaths(data.edges, nodePositions, nodeRadius),
    [data.edges, nodePositions, nodeRadius]
  );

  return (
    <div className="flex justify-center items-center">
      {/* <div className="border border-gray-300 bg-white rounded-lg shadow-sm"> */}
      <div className="bg-white rounded-lg shadow-sm">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          {/* Define arrow marker */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
            </marker>
          </defs>

          {/* Render Edges */}
          {edgePaths.map((edge, index) => (
            <line
              key={`edge-${index}`}
              x1={edge.startX}
              y1={edge.startY}
              x2={edge.endX}
              y2={edge.endY}
              stroke="#333"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          ))}

          {/* Render Nodes */}
          {data.nodes.map((node) => {
            const position = nodePositions[node];
            return (
              <g key={`node-${node}`}>
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={nodeRadius}
                  fill="#6495ED77"
                  stroke="#4169E1"
                  strokeWidth="2"
                />
                <foreignObject
                  x={position.x - nodeRadius + 5}
                  y={position.y - nodeRadius / 2}
                  width={nodeRadius * 2 - 10}
                  height={nodeRadius}
                >
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center text-white text-sm font-medium overflow-hidden">
                      {node}
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default DirectedGraph;
