import "./Canvas.css";
import { useRef, useState, useEffect } from "react";
const Canvas = ({ activeTool, elements, setElements }) => {
  const canvasRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);

  const [startPoint, setStartPoint] = useState(null);
  const [previewRect, setPreviewRect] = useState(null);
  const handleMouseDown = (e) => {
  if (activeTool !== "rectangle") return;

  setIsDrawing(true);

  setStartPoint({
    x: e.nativeEvent.offsetX,
    y: e.nativeEvent.offsetY,
  });
};
const handleMouseUp = (e) => {
  if (!isDrawing) return;

  const endX = e.nativeEvent.offsetX;
  const endY = e.nativeEvent.offsetY;

  const rectangle = {
    type: "rectangle",
    x: startPoint.x,
    y: startPoint.y,
    width: endX - startPoint.x,
    height: endY - startPoint.y,
  };

  setElements((prev) => [
    ...prev,
    rectangle,
  ]);

  setIsDrawing(false);
};
const handleMouseMove = (e) => {
  if (!isDrawing) return;

  const currentX = e.nativeEvent.offsetX;
  const currentY = e.nativeEvent.offsetY;

  setPreviewRect({
    type: "rectangle",
    x: startPoint.x,
    y: startPoint.y,
    width: currentX - startPoint.x,
    height: currentY - startPoint.y,
  });
};
useEffect(() => {
  const canvas = canvasRef.current;

  const ctx = canvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  elements.forEach((element) => {
    if (element.type === "rectangle") {
      ctx.strokeRect(
        element.x,
        element.y,
        element.width,
        element.height
      );
    }
  });
  if (previewRect) {
  ctx.strokeRect(
    previewRect.x,
    previewRect.y,
    previewRect.width,
    previewRect.height
  );
}
}, [elements, previewRect]);
  return <canvas   ref={canvasRef}  width={window.innerWidth} height={window.innerHeight} onMouseDown={handleMouseDown}
  onMouseUp={handleMouseUp}    onMouseMove={handleMouseMove}
    />;
};

export default Canvas;
