import React, { useRef, useEffect, useState } from "react";

export default function VennDiagram({ config }) {
  const canvasRef = useRef(null);
  const isServer = typeof window === "undefined";

  // Use simple defaults; allow overrides via config
  const defaultConfig = {
    text1: "Set A",
    text2: "Set B",
    color1: "rgba(255,0,0,0.5)",
    color2: "rgba(0,0,255,0.5)",
  };

  const mergedConfig = { ...defaultConfig, ...config };

  // Initialize dimensions with reasonable defaults for both client and server
  const [dimensions, setDimensions] = useState({
    width: 600,
    height: 400,
  });

  // Handle window resize (client-side only)
  useEffect(() => {
    if (isServer) return;

    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const widthPercentage = isMobile ? 0.8 : 0.6;
      const newWidth = window.innerWidth * widthPercentage;
      const ratio = isMobile ? 1.1 : 1.5;
      const newHeight = newWidth / ratio;

      setDimensions({
        width: newWidth,
        height: newHeight,
      });
    };

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Call once to set initial size
    handleResize();

    // Clean up
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Draw the diagram whenever dimensions or config changes (client-side only)
  useEffect(() => {
    if (isServer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Update canvas dimensions
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext("2d");

    // Compute circle positions and sizes based on current dimensions
    const radius = Math.min(dimensions.width, dimensions.height) * 0.3;

    // Adjust circle positions for mobile
    const isMobile = dimensions.width < dimensions.height;
    const center1X = isMobile
      ? dimensions.width * 0.45
      : dimensions.width * 0.35;
    const center2X = isMobile
      ? dimensions.width * 0.6
      : dimensions.width * 0.65;
    const center1 = { x: center1X, y: dimensions.height / 2 };
    const center2 = { x: center2X, y: dimensions.height / 2 };

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw first circle
    ctx.beginPath();
    ctx.arc(center1.x, center1.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = mergedConfig.color1;
    ctx.fill();
    ctx.strokeStyle = "#404040";
    ctx.stroke();

    // Draw second circle
    ctx.beginPath();
    ctx.arc(center2.x, center2.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = mergedConfig.color2;
    ctx.fill();
    ctx.strokeStyle = "#404040";
    ctx.stroke();

    // Scale font size based on canvas size
    const fontSize = Math.max(12, Math.min(16, dimensions.width / 25));
    ctx.fillStyle = "#000";
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(mergedConfig.text1, center1.x, center1.y);
    ctx.fillText(mergedConfig.text2, center2.x, center2.y);
  }, [dimensions, mergedConfig]);

  // For server-side rendering, return a placeholder SVG instead of null
  // This ensures we have matching DOM structure for hydration
  if (isServer) {
    return (
      <div className="w-full flex justify-center">
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          style={{
            maxWidth: "100%",
            border: "none",
          }}
          className="venn-diagram-placeholder"
        >
          {/* Placeholder circles with text for server rendering */}
          <circle
            cx={dimensions.width * 0.35}
            cy={dimensions.height / 2}
            r={Math.min(dimensions.width, dimensions.height) * 0.3}
            fill={mergedConfig.color1}
            stroke="#404040"
          />
          <circle
            cx={dimensions.width * 0.65}
            cy={dimensions.height / 2}
            r={Math.min(dimensions.width, dimensions.height) * 0.3}
            fill={mergedConfig.color2}
            stroke="#404040"
          />
          <text
            x={dimensions.width * 0.35}
            y={dimensions.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.max(12, Math.min(16, dimensions.width / 25))}
          >
            {mergedConfig.text1}
          </text>
          <text
            x={dimensions.width * 0.65}
            y={dimensions.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.max(12, Math.min(16, dimensions.width / 25))}
          >
            {mergedConfig.text2}
          </text>
        </svg>
      </div>
    );
  }

  // Client-side rendering
  return (
    <div className="w-full flex justify-center">
      <canvas
        ref={canvasRef}
        style={{
          border: "none",
          width: dimensions.width,
          height: dimensions.height,
          maxWidth: "100%",
        }}
      />
    </div>
  );
}
