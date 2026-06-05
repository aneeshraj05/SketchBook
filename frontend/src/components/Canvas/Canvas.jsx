import "./Canvas.css";
import { useRef, useState, useEffect } from "react";
import rough from "roughjs";
import { getStroke } from "perfect-freehand";

const generator = rough.generator();

const getSvgPathFromStroke = (stroke) => {
  if (!stroke.length) return "";
  const d = stroke.reduce((acc, [x, y], i) => {
    if (i === 0) acc.push("M", x, y);
    else acc.push("L", x, y);
    return acc;
  }, []);
  d.push("Z");
  return d.join(" ");
};

const getNumericStrokeWidth = (size, tool) => {
  const base = typeof size === "number" ? size : 3;
  if (typeof size === "string") {
    const s = size.toLowerCase();
    if (tool === "text") {
      switch (s) {
        case "s":
          return 16;
        case "m":
          return 22;
        case "l":
          return 30;
        case "xl":
          return 42;
        default:
          return 22;
      }
    }
    switch (s) {
      case "s":
        return tool === "pencil" ? 2 : 2;
      case "m":
        return tool === "pencil" ? 4.5 : 3.5;
      case "l":
        return tool === "pencil" ? 8 : 6;
      case "xl":
        return tool === "pencil" ? 14 : 9;
      default:
        return tool === "pencil" ? 4.5 : 3.5;
    }
  }
  return base;
};

const getClosestAnchorPointOnShape = (point, shape) => {
  if (
    !shape ||
    shape.type === "pencil" ||
    shape.type === "line" ||
    shape.type === "arrow"
  ) {
    return null;
  }
  const xMin = shape.x;
  const xMax = shape.x + shape.width;
  const yMin = shape.y;
  const yMax = shape.y + shape.height;

  if (
    point.x >= xMin &&
    point.x <= xMax &&
    point.y >= yMin &&
    point.y <= yMax
  ) {
    return { x: point.x, y: point.y };
  }

  const clampedX = Math.max(xMin, Math.min(point.x, xMax));
  const clampedY = Math.max(yMin, Math.min(point.y, yMax));

  const dl = Math.abs(point.x - xMin);
  const dr = Math.abs(point.x - xMax);
  const dt = Math.abs(point.y - yMin);
  const db = Math.abs(point.y - yMax);

  const minDist = Math.min(dl, dr, dt, db);

  if (minDist === dl) return { x: xMin, y: clampedY };
  if (minDist === dr) return { x: xMax, y: clampedY };
  if (minDist === dt) return { x: clampedX, y: yMin };
  return { x: clampedX, y: yMax };
};

const findSnapTarget = (point, elements, selfId = null, threshold = 25) => {
  let closestTarget = null;
  let minDistance = threshold;

  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.id === selfId) continue;

    const xMin = el.x;
    const xMax = el.x + el.width;
    const yMin = el.y;
    const yMax = el.y + el.height;

    if (el.type !== "pencil" && el.type !== "line" && el.type !== "arrow") {
      if (
        point.x >= xMin &&
        point.x <= xMax &&
        point.y >= yMin &&
        point.y <= yMax
      ) {
        return { point: { x: point.x, y: point.y }, shapeId: el.id };
      }
    }

    const anchor = getClosestAnchorPointOnShape(point, el);
    if (!anchor) continue;

    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      closestTarget = { point: anchor, shapeId: el.id };
    }
  }
  return closestTarget;
};

const Canvas = ({
  zoomResetTrigger,
  activeTool,
  elements,
  setElements,
  selectedId,
  setSelectedId,
  isDragging,
  setIsDragging,
  strokeColor,
  bgColor,
  strokeWidth,
  opacity,
  strokeType,
  roughness,
  gridType = "none",
}) => {
  const canvasRef = useRef(null);
  const permanentTextAreaRef = useRef(null);
  const imageCache = useRef({});

  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  // Add this block directly under your state definitions in Canvas.jsx:
  useEffect(() => {
    if (zoomResetTrigger > 0) {
      // 1. Reset your React tracking states back to original defaults
      setZoom(1);
      setPan({ x: 0, y: 0 });
      
      // 2. Clear out the low-level HTML5 canvas rendering context matrix
      const canvasElement = document.getElementById("drawing-board") || document.querySelector("canvas");
      if (canvasElement) {
        const ctx = canvasElement.getContext("2d");
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0); // Completely flattens custom zoom matrix coordinates
        }
      }
    }
  }, [zoomResetTrigger]); // Listens directly to the pipeline trigger tracking from App.jsx

  const [lassoSelection, setLassoSelection] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [dragOffsets, setDragOffsets] = useState({});

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [previewRect, setPreviewRect] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [editorOverlay, setEditorOverlay] = useState({
    visible: false,
    x: 0,
    y: 0,
    value: "",
    editingId: null,
  });

  const [cropTarget, setCropTarget] = useState(null);
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [snapIndicator, setSnapIndicator] = useState(null);

  const mouseCoords = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isDrawing || isDragging) return;

    let linksMutated = false;
    const updated = elements.map((el) => {
      if (
        el.type === "arrow" &&
        el.points &&
        el.points.length === 2 &&
        (el.startSocketId || el.endSocketId)
      ) {
        let p1 = { ...el.points[0] };
        let p2 = { ...el.points[1] };

        const absoluteP1 = { x: el.x + p1.x, y: el.y + p1.y };
        const absoluteP2 = { x: el.x + p2.x, y: el.y + p2.y };

        if (el.startSocketId) {
          const target = elements.find((s) => s.id === el.startSocketId);
          if (target) {
            const anchor = getClosestAnchorPointOnShape(absoluteP1, target);
            if (anchor) {
              absoluteP1.x = anchor.x;
              absoluteP1.y = anchor.y;
            }
          }
        }

        if (el.endSocketId) {
          const target = elements.find((s) => s.id === el.endSocketId);
          if (target) {
            const anchor = getClosestAnchorPointOnShape(absoluteP2, target);
            if (anchor) {
              absoluteP2.x = anchor.x;
              absoluteP2.y = anchor.y;
            }
          }
        }

        const minX = Math.min(absoluteP1.x, absoluteP2.x);
        const minY = Math.min(absoluteP1.y, absoluteP2.y);
        const maxX = Math.max(absoluteP1.x, absoluteP2.x);
        const maxY = Math.max(absoluteP1.y, absoluteP2.y);

        const nextP1 = { x: absoluteP1.x - minX, y: absoluteP1.y - minY };
        const nextP2 = { x: absoluteP2.x - minX, y: absoluteP2.y - minY };

        if (
          minX !== el.x ||
          minY !== el.y ||
          nextP1.x !== p1.x ||
          nextP1.y !== p1.y ||
          nextP2.x !== p2.x ||
          nextP2.y !== p2.y
        ) {
          linksMutated = true;
          return generateRoughElement(
            el.id,
            "arrow",
            minX,
            minY,
            maxX - minX,
            maxY - minY,
            [nextP1, nextP2],
            el.properties,
            null,
            null,
            el.startSocketId,
            el.endSocketId,
          );
        }
      }
      return el;
    });

    if (linksMutated) {
      setElements(updated);
      localStorage.setItem("whiteboard-data", JSON.stringify(updated));
    }
  }, [elements, isDrawing, isDragging]);

  useEffect(() => {
    const cachedData = localStorage.getItem("whiteboard-data");
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        setElements(parsed);
        setHistory([parsed]);
        setHistoryIndex(0);
      } catch (e) {
        console.error("Local recovery stream interrupted.", e);
      }
    }
  }, [setElements]);

  useEffect(() => {
    const trackMouse = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      mouseCoords.current = {
        x: (screenX - pan.x) / zoom,
        y: (screenY - pan.y) / zoom,
      };
    };
    window.addEventListener("mousemove", trackMouse);
    return () => window.removeEventListener("mousemove", trackMouse);
  }, [pan, zoom]);

  useEffect(() => {
    if (editorOverlay.visible || activeTool === "lock") return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
              const newImageElement = {
                id: Date.now(),
                type: "image",
                x: mouseCoords.current.x,
                y: mouseCoords.current.y,
                width: img.width > 500 ? 500 : img.width,
                height:
                  img.width > 500 ? img.height * (500 / img.width) : img.height,
                src: event.target.result,
                crop: { x: 0, y: 0, width: img.width, height: img.height },
                properties: { opacity: 100 },
              };
              saveActionToHistory([...elements, newImageElement]);
            };
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }

        if (item.type === "text/plain") {
          item.getAsString((text) => {
            const currentFontSize = getNumericStrokeWidth(strokeWidth, "text");
            const textWidth = text
              .split("\n")
              .reduce(
                (max, line) =>
                  Math.max(max, line.length * (currentFontSize * 0.6)),
                0,
              );
            const textHeight =
              text.split("\n").length * (currentFontSize * 1.2);

            const newTextElement = {
              id: Date.now(),
              type: "text",
              x: mouseCoords.current.x,
              y: mouseCoords.current.y,
              width: textWidth,
              height: textHeight,
              text: text,
              properties: { stroke: strokeColor, strokeWidth, opacity },
            };
            saveActionToHistory([...elements, newTextElement]);
          });
          e.preventDefault();
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [
    elements,
    strokeColor,
    strokeWidth,
    opacity,
    editorOverlay.visible,
    activeTool,
  ]);

  useEffect(() => {
    if (selectedIds.length > 0) {
      const updated = elements.map((el) => {
        if (selectedIds.includes(el.id)) {
          const props = {
            ...el.properties,
            stroke: strokeColor,
            fill: bgColor,
            strokeWidth,
            opacity,
            strokeType,
            roughness,
          };
          return generateRoughElement(
            el.id,
            el.type,
            el.x,
            el.y,
            el.width,
            el.height,
            el.points,
            props,
            el.src,
            el.crop,
            el.startSocketId,
            el.endSocketId,
          );
        }
        return el;
      });
      setElements(updated);
      localStorage.setItem("whiteboard-data", JSON.stringify(updated));
    }
  }, [strokeColor, bgColor, strokeWidth, opacity, strokeType, roughness]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      if (activeTool === "lock") return;
      e.preventDefault();
      if (e.ctrlKey) {
        const zoomFactor = 1.05;
        const nextZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
        setZoom(Math.min(Math.max(nextZoom, 0.1), 4));
      } else {
        setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [zoom, activeTool]);

  const duplicateSelectedElements = () => {
    if (selectedIds.length === 0) return;

    const elementsToDuplicate = elements.filter((el) =>
      selectedIds.includes(el.id),
    );
    const idMapping = {};

    const copiedElements = elementsToDuplicate.map((el) => {
      const newId = Date.now() + Math.random();
      idMapping[el.id] = newId;

      return {
        ...el,
        id: newId,
        x: el.x + 30,
        y: el.y + 30,
        points: el.points ? el.points.map((p) => ({ ...p })) : null,
        roughGeometry: el.roughGeometry ? { ...el.roughGeometry } : null,
      };
    });

    const finalizedCopies = copiedElements.map((el) => {
      if (el.type === "arrow") {
        return {
          ...el,
          startSocketId: idMapping[el.startSocketId] || null,
          endSocketId: idMapping[el.endSocketId] || null,
        };
      }
      return el;
    });

    const outputElements = [...elements, ...finalizedCopies];
    setSelectedIds(copiedElements.map((c) => c.id));
    saveActionToHistory(outputElements);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (editorOverlay.visible || cropTarget) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelectedElements();
        return;
      }

      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        selectedIds.length > 0
      ) {
        if (activeTool === "lock") return;
        e.preventDefault();
        const remainingElements = elements.filter(
          (el) => !selectedIds.includes(el.id),
        );
        setSelectedIds([]);
        setSelectedId(null);
        saveActionToHistory(remainingElements);
        return;
      }

      if (e.code === "Space") {
        if (activeTool === "lock") return;
        e.preventDefault();
        setSpacePressed(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === "Space") setSpacePressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    historyIndex,
    history,
    editorOverlay.visible,
    cropTarget,
    selectedIds,
    elements,
    activeTool,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (permanentTextAreaRef.current && editorOverlay.visible) {
      setTimeout(() => {
        permanentTextAreaRef.current.focus();
      }, 0);
    }
  }, [editorOverlay.visible]);

  const saveActionToHistory = (newElements) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, newElements]);
    setHistoryIndex(nextHistory.length);
    setElements(newElements);
    localStorage.setItem("whiteboard-data", JSON.stringify(newElements));
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      localStorage.setItem(
        "whiteboard-data",
        JSON.stringify(history[newIndex]),
      );
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      localStorage.setItem(
        "whiteboard-data",
        JSON.stringify(history[newIndex]),
      );
    }
  };

  const getCoordinates = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  const generateRoughElement = (
    id,
    type,
    x,
    y,
    width,
    height,
    customPoints = null,
    properties = {},
    src = null,
    crop = null,
    startSocketId = null,
    endSocketId = null,
  ) => {
    const rawStrokeWidth = properties.strokeWidth || strokeWidth;
    const sWidth = getNumericStrokeWidth(rawStrokeWidth, type);
    const { stroke = "#000000", fill = "transparent" } = properties;

    const currentStrokeType = properties.strokeType || strokeType;
    const currentRoughness =
      properties.roughness !== undefined ? properties.roughness : roughness;

    let strokeLineDash = undefined;
    if (currentStrokeType === "dashed") {
      strokeLineDash = [sWidth * 3 + 4, sWidth * 2 + 4];
    } else if (currentStrokeType === "dotted") {
      strokeLineDash = [sWidth, sWidth * 2 + 2];
    }

    const options = {
      stroke,
      strokeWidth: sWidth,
      roughness: currentRoughness,
      strokeLineDash,
      fill: fill !== "transparent" ? fill : undefined,
      fillStyle: "solid",
    };

    let roughGeometry = null;
    let strokePathStr = null;

    if (type === "pencil" || type === "line") {
      if (customPoints) {
        const strokeOutline = getStroke(
          customPoints.map((p) => [p.x, p.y]),
          {
            size: type === "pencil" ? sWidth * 2.2 : sWidth * 1.5,
            thinning: 0.2,
            smoothing: 0.6,
            streamline: 0.5,
            simulatePressure: type === "pencil",
          },
        );
        strokePathStr = getSvgPathFromStroke(strokeOutline);
      }
    } else if (type === "arrow") {
      if (customPoints && customPoints.length >= 2) {
        const p1 = customPoints[0];
        const p2 = customPoints[1];
        const linePart = generator.line(p1.x, p1.y, p2.x, p2.y, options);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const headLength = sWidth * 4 + 10;
        const arrowAngle = Math.PI / 6;

        const leftWingX = p2.x - headLength * Math.cos(angle - arrowAngle);
        const leftWingY = p2.y - headLength * Math.sin(angle - arrowAngle);
        const rightWingX = p2.x - headLength * Math.cos(angle + arrowAngle);
        const rightWingY = p2.y - headLength * Math.sin(angle + arrowAngle);

        const headPart = generator.polygon(
          [
            [leftWingX, leftWingY],
            [p2.x, p2.y],
            [rightWingX, rightWingY],
          ],
          { ...options, fill: stroke },
        );
        roughGeometry = {
          sets: [...linePart.sets, ...headPart.sets],
          options: options,
        };
      }
    } else if (type === "rectangle") {
      roughGeometry = generator.rectangle(0, 0, width, height, options);
    } else if (type === "circle") {
      roughGeometry = generator.ellipse(
        width / 2,
        height / 2,
        width,
        height,
        options,
      );
    } else if (type === "diamond") {
      const xc = width / 2;
      const yc = height / 2;
      roughGeometry = generator.polygon(
        [
          [xc, 0],
          [width, yc],
          [xc, height],
          [0, yc],
        ],
        options,
      );
    }

    return {
      id,
      type,
      x,
      y,
      width,
      height,
      points: customPoints,
      roughGeometry,
      strokePathStr,
      src,
      crop,
      startSocketId,
      endSocketId,
      properties: {
        ...properties,
        strokeWidth: rawStrokeWidth,
        strokeType: currentStrokeType,
        roughness: currentRoughness,
      },
    };
  };

  const getShapeAtPosition = (x, y) => {
    return [...elements].reverse().find((element) => {
      if (
        element.type === "pencil" ||
        element.type === "line" ||
        element.type === "arrow"
      ) {
        return (
          x >= element.x - 10 &&
          x <= element.x + element.width + 10 &&
          y >= element.y - 10 &&
          y <= element.y + element.height + 10
        );
      }
      return (
        x >= element.x &&
        x <= element.x + element.width &&
        y >= element.y &&
        y <= element.y + element.height
      );
    });
  };

  const handleDoubleClick = (e) => {
    if (activeTool !== "select" || activeTool === "lock") return;
    const worldCoords = getCoordinates(e);
    const clickedShape = getShapeAtPosition(worldCoords.x, worldCoords.y);

    if (clickedShape) {
      if (clickedShape.type === "image") {
        setCropTarget(clickedShape);
        setCropBox({
          x: clickedShape.crop?.x || 0,
          y: clickedShape.crop?.y || 0,
          width: clickedShape.crop?.width || clickedShape.width,
          height: clickedShape.crop?.height || clickedShape.height,
        });
      } else if (clickedShape.type === "text") {
        setEditorOverlay({
          visible: true,
          x: clickedShape.x,
          y: clickedShape.y,
          value: clickedShape.text,
          editingId: clickedShape.id,
        });
        setSelectedIds([]);
      }
    }
  };

  const executeCropCommit = () => {
    if (!cropTarget) return;
    const imgElement = imageCache.current[cropTarget.id];
    if (!imgElement) return;

    const scaleFactorX =
      cropTarget.width / (cropTarget.crop?.width || imgElement.width);
    const scaleFactorY =
      cropTarget.height / (cropTarget.crop?.height || imgElement.height);

    const updatedElements = elements.map((el) => {
      if (el.id === cropTarget.id) {
        return {
          ...el,
          x: el.x + (cropBox.x - (el.crop?.x || 0)) * scaleFactorX,
          y: el.y + (cropBox.y - (el.crop?.y || 0)) * scaleFactorY,
          width: cropBox.width * scaleFactorX,
          height: cropBox.height * scaleFactorY,
          crop: { ...cropBox },
        };
      }
      return el;
    });

    saveActionToHistory(updatedElements);
    setCropTarget(null);
  };

  const handleMouseDown = (e) => {
    if (activeTool === "lock") return;
    if (editorOverlay.visible) {
      commitTextAreaValue();
      return;
    }

    if (e.button === 1 || activeTool === "pan" || spacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const worldCoords = getCoordinates(e);
    if (activeTool === "text") {
      setEditorOverlay({
        visible: true,
        x: worldCoords.x,
        y: worldCoords.y,
        value: "",
        editingId: null,
      });
      setSelectedIds([]);
      return;
    }

    const clickedShape = getShapeAtPosition(worldCoords.x, worldCoords.y);

    if (activeTool === "eraser") {
      if (clickedShape) {
        saveActionToHistory(elements.filter((el) => el.id !== clickedShape.id));
      }
      return;
    }

    if (activeTool === "select") {
      if (clickedShape) {
        let currentSelection = [...selectedIds];
        if (e.shiftKey) {
          if (currentSelection.includes(clickedShape.id)) {
            currentSelection = currentSelection.filter(
              (id) => id !== clickedShape.id,
            );
          } else {
            currentSelection.push(clickedShape.id);
          }
        } else {
          if (!currentSelection.includes(clickedShape.id)) {
            currentSelection = [clickedShape.id];
          }
        }

        if (e.altKey) {
          const elementsToClone = elements.filter((el) =>
            currentSelection.includes(el.id),
          );
          const generatedClones = elementsToClone.map((el) => ({
            ...el,
            id: Date.now() + Math.random(),
            points: el.points ? el.points.map((p) => ({ ...p })) : null,
          }));

          setElements([...elements, ...generatedClones]);
          currentSelection = generatedClones.map((g) => g.id);
        }

        setSelectedIds(currentSelection);
        setSelectedId(clickedShape.id);

        const offsets = {};
        currentSelection.forEach((id) => {
          const target = elements.find((el) => el.id === id);
          if (target) {
            offsets[id] = {
              x: worldCoords.x - target.x,
              y: worldCoords.y - target.y,
            };
          }
        });
        setDragOffsets(offsets);
        setIsDragging(true);
      } else {
        if (!e.shiftKey) setSelectedIds([]);
        setLassoSelection({
          startX: worldCoords.x,
          startY: worldCoords.y,
          endX: worldCoords.x,
          endY: worldCoords.y,
        });
      }
      return;
    }

    const validTools = [
      "rectangle",
      "circle",
      "diamond",
      "line",
      "arrow",
      "pencil",
    ];
    if (!validTools.includes(activeTool)) return;

    setIsDrawing(true);

    let actualStart = { x: worldCoords.x, y: worldCoords.y };
    if (activeTool === "arrow") {
      const snapStart = findSnapTarget(worldCoords, elements);
      if (snapStart) {
        actualStart = snapStart.point;
      }
    }

    setStartPoint(actualStart);
    setCurrentPath([actualStart]);
  };

  const handleMouseMove = (e) => {
    if (activeTool === "lock") return;

    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    const worldCoords = getCoordinates(e);
    let yMax;
    if (lassoSelection && activeTool === "select") {
      const nextLasso = {
        ...lassoSelection,
        endX: worldCoords.x,
        endY: worldCoords.y,
      };
      setLassoSelection(nextLasso);

      const xMin = Math.min(nextLasso.startX, nextLasso.endX);
      const xMax = Math.max(nextLasso.startX, nextLasso.endX);
      const yMin = Math.min(nextLasso.startY, nextLasso.endY);
      const maxY = Math.max(nextLasso.startY, nextLasso.endY);

      const captured = elements
        .filter(
          (el) =>
            el.x >= xMin &&
            el.x + el.width <= xMax &&
            el.y >= yMin &&
            el.y + el.height <= yMax,
        )
        .map((el) => el.id);

      setSelectedIds(captured);
      return;
    }

    if (activeTool === "select" && isDragging && selectedIds.length > 0) {
      setElements((prev) =>
        prev.map((element) => {
          if (selectedIds.includes(element.id)) {
            const offset = dragOffsets[element.id] || { x: 0, y: 0 };
            const newX = worldCoords.x - offset.x;
            const newY = worldCoords.y - offset.y;

            return {
              ...element,
              x: newX,
              y: newY,
              strokePathStr: element.strokePathStr
                ? getSvgPathFromStroke(
                    getStroke(
                      element.points.map((p) => [p.x, p.y]),
                      {
                        size:
                          element.type === "pencil"
                            ? getNumericStrokeWidth(
                                element.properties.strokeWidth,
                                element.type,
                              ) * 2.2
                            : getNumericStrokeWidth(
                                element.properties.strokeWidth,
                                element.type,
                              ) * 1.5,
                        simulatePressure: element.type === "pencil",
                      },
                    ),
                  )
                : null,
            };
          }
          return element;
        }),
      );
      return;
    }

    if (!isDrawing) return;

    if (
      activeTool === "pencil" ||
      activeTool === "line" ||
      activeTool === "arrow"
    ) {
      // 👈 FIX: Appending elements sequentially without rewriting arrays directly
      const displayPoints =
        activeTool === "pencil"
          ? [...currentPath, worldCoords]
          : [startPoint, worldCoords];

      if (activeTool === "pencil") {
        setCurrentPath(displayPoints);
      }

      let finalDisplayPoints = displayPoints;
      if (activeTool === "line" || activeTool === "arrow") {
        let currentTargetPoint = { ...worldCoords };
        if (activeTool === "arrow") {
          const snapEnd = findSnapTarget(currentTargetPoint, elements);
          if (snapEnd) {
            currentTargetPoint = snapEnd.point;
            setSnapIndicator(snapEnd.point);
          } else {
            setSnapIndicator(null);
          }
        }
        finalDisplayPoints = [startPoint, currentTargetPoint];
      }

      const minX = Math.min(...finalDisplayPoints.map((p) => p.x));
      const minY = Math.min(...finalDisplayPoints.map((p) => p.y));
      const maxX = Math.max(...finalDisplayPoints.map((p) => p.x));
      const maxY = Math.max(...finalDisplayPoints.map((p) => p.y));

      setPreviewRect({
        type: activeTool,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        points: finalDisplayPoints,
      });
    } else {
      const x = Math.min(startPoint.x, worldCoords.x);
      const y = Math.min(startPoint.y, worldCoords.y);
      const width = Math.abs(worldCoords.x - startPoint.x);
      const height = Math.abs(worldCoords.y - startPoint.y);
      setPreviewRect({ type: activeTool, x, y, width, height });
    }
  };

  const handleMouseUp = () => {
    setSnapIndicator(null);
    if (activeTool === "lock") return;
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (lassoSelection) {
      setLassoSelection(null);
      return;
    }
    if (activeTool === "select" && isDragging) {
      setIsDragging(false);
      saveActionToHistory(elements);
      return;
    }
    if (!isDrawing) return;

    if (previewRect) {
      let finalPoints = previewRect.points;
      let startSocketId = null;
      let endSocketId = null;

      if (
        finalPoints &&
        (previewRect.type === "pencil" ||
          previewRect.type === "line" ||
          previewRect.type === "arrow")
      ) {
        const absoluteStart = finalPoints[0];
        const absoluteEnd = finalPoints[finalPoints.length - 1];

        if (previewRect.type === "arrow") {
          const checkStartSnap = findSnapTarget(absoluteStart, elements);
          if (checkStartSnap) startSocketId = checkStartSnap.shapeId;

          const checkEndSnap = findSnapTarget(absoluteEnd, elements);
          if (checkEndSnap) endSocketId = checkEndSnap.shapeId;
        }

        finalPoints = finalPoints.map((p) => ({
          x: p.x - previewRect.x,
          y: p.y - previewRect.y,
        }));
      }

      const savedElement = generateRoughElement(
        Date.now(),
        previewRect.type,
        previewRect.x,
        previewRect.y,
        previewRect.width,
        previewRect.height,
        finalPoints,
        {
          stroke: strokeColor,
          fill: bgColor,
          strokeWidth,
          opacity,
          strokeType,
          roughness,
        },
        null,
        null,
        startSocketId,
        endSocketId,
      );
      saveActionToHistory([...elements, savedElement]);
    }

    setPreviewRect(null);
    setCurrentPath([]);
    setIsDrawing(false);
  };

  const commitTextAreaValue = () => {
    if (!editorOverlay.visible) return;

    if (editorOverlay.value.trim() === "") {
      if (editorOverlay.editingId) {
        saveActionToHistory(
          elements.filter((el) => el.id !== editorOverlay.editingId),
        );
      }
    } else {
      const currentFontSize = getNumericStrokeWidth(strokeWidth, "text");
      const textWidth = editorOverlay.value
        .split("\n")
        .reduce(
          (max, line) => Math.max(max, line.length * (currentFontSize * 0.6)),
          0,
        );
      const textHeight =
        editorOverlay.value.split("\n").length * (currentFontSize * 1.2);

      if (editorOverlay.editingId) {
        const adjusted = elements.map((el) => {
          if (el.id === editorOverlay.editingId) {
            return {
              ...el,
              text: editorOverlay.value,
              width: textWidth,
              height: textHeight,
            };
          }
          return el;
        });
        saveActionToHistory(adjusted);
      } else {
        const newTextElement = {
          id: Date.now(),
          type: "text",
          x: editorOverlay.x,
          y: editorOverlay.y,
          width: textWidth,
          height: textHeight,
          text: editorOverlay.value,
          properties: { stroke: strokeColor, strokeWidth, opacity },
        };
        saveActionToHistory([...elements, newTextElement]);
      }
    }
    setEditorOverlay({
      visible: false,
      x: 0,
      y: 0,
      value: "",
      editingId: null,
    });
  };

  // 👈 NEW: INFINITE PERSISTENT GRID DRAW ENGINE
  const drawBackgroundGrid = (ctx, canvasWidth, canvasHeight) => {
    if (gridType === "none") return;

    ctx.save();
    ctx.strokeStyle = "rgba(33, 37, 41, 0.09)";
    ctx.fillStyle = "rgba(33, 37, 41, 0.14)";
    ctx.lineWidth = 1;

    const gridSize = 30;

    // Inverse Matrix Map calculation to discover active tracking coordinates
    const startX = -pan.x / zoom;
    const startY = -pan.y / zoom;
    const endX = startX + canvasWidth / zoom;
    const endY = startY + canvasHeight / zoom;

    // Round bounding boxes to exact structural grid alignment nodes
    const firstX = Math.floor(startX / gridSize) * gridSize;
    const firstY = Math.floor(startY / gridSize) * gridSize;

    if (gridType === "dots") {
      const dotRadius = 1.2 / zoom;
      for (let x = firstX; x <= endX; x += gridSize) {
        for (let y = firstY; y <= endY; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    } else if (gridType === "engineering") {
      // Render X Grid Vertical Paths
      for (let x = firstX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }
      // Render Y Grid Horizontal Paths
      for (let y = firstY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rc = rough.canvas(canvas);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1st Layer: Global Workspace Transformation Matrix mapping for grids
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    drawBackgroundGrid(ctx, canvas.width, canvas.height);
    ctx.restore();

    // 2nd Layer: Object Vectors mapping
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    elements.forEach((element) => {
      ctx.save();
      ctx.globalAlpha =
        element.properties?.opacity !== undefined
          ? element.properties.opacity / 100
          : 1;

      if (
        selectedIds.includes(element.id) &&
        activeTool === "select" &&
        !cropTarget
      ) {
        ctx.strokeStyle = "#4c8bf5";
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.strokeRect(
          element.x - 6,
          element.y - 6,
          element.width + 12,
          element.height + 12,
        );
      }

      ctx.translate(element.x, element.y);

      if (element.type === "image" && element.src) {
        let img = imageCache.current[element.id];
        if (!img) {
          img = new Image();
          img.src = element.src;
          img.onload = () => {
            imageCache.current[element.id] = img;
            setElements([...elements]);
          };
        } else {
          const cropX = element.crop?.x !== undefined ? element.crop.x : 0;
          const cropY = element.crop?.y !== undefined ? element.crop.y : 0;
          const cropW = element.crop?.width || img.width;
          const cropH = element.crop?.height || img.height;
          ctx.drawImage(
            img,
            cropX,
            cropY,
            cropW,
            cropH,
            0,
            0,
            element.width,
            element.height,
          );
        }
      } else if (element.type === "text") {
        const fSize = getNumericStrokeWidth(
          element.properties?.strokeWidth || strokeWidth,
          "text",
        );
        ctx.font = `${fSize}px helvetica, arial, sans-serif`;
        ctx.fillStyle = element.properties?.stroke || "#000000";
        ctx.textBaseline = "top";
        const lines = (element.text || "").split("\n");
        lines.forEach((line, index) =>
          ctx.fillText(line, 0, index * (fSize * 1.2)),
        );
      } else if (element.strokePathStr) {
        ctx.fillStyle = element.properties?.stroke || "#000000";
        ctx.fill(new Path2D(element.strokePathStr));
      } else if (element.roughGeometry) {
        if (element.type === "arrow") {
          element.roughGeometry.sets.forEach((set) =>
            rc.draw({ sets: [set], options: element.roughGeometry.options }),
          );
        } else {
          rc.draw(element.roughGeometry);
        }
      }
      ctx.restore();
    });

    if (previewRect) {
      ctx.save();
      ctx.globalAlpha = opacity / 100;

      const isVectorType =
        previewRect.type === "pencil" ||
        previewRect.type === "line" ||
        previewRect.type === "arrow";

      const temporaryPreview = generateRoughElement(
        "preview",
        previewRect.type,
        previewRect.x,
        previewRect.y,
        previewRect.width,
        previewRect.height,
        previewRect.points,
        {
          stroke: strokeColor,
          fill: bgColor,
          strokeWidth,
          strokeType,
          roughness,
        },
      );

      if (!isVectorType) {
        ctx.translate(temporaryPreview.x, temporaryPreview.y);
      }

      if (temporaryPreview.strokePathStr) {
        ctx.fillStyle = strokeColor;
        ctx.fill(new Path2D(temporaryPreview.strokePathStr));
      } else if (temporaryPreview.roughGeometry) {
        if (temporaryPreview.type === "arrow") {
          temporaryPreview.roughGeometry.sets.forEach((set) =>
            rc.draw({
              sets: [set],
              options: temporaryPreview.roughGeometry.options,
            }),
          );
        } else {
          rc.draw(temporaryPreview.roughGeometry);
        }
      }
      ctx.restore();
    }

    if (snapIndicator && activeTool === "arrow") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(snapIndicator.x, snapIndicator.y, 6 / zoom, 0, 2 * Math.PI);
      ctx.strokeStyle = "#ff4757";
      ctx.lineWidth = 2 / zoom;
      ctx.fillStyle = "rgba(255, 71, 87, 0.3)";
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (lassoSelection && activeTool === "select") {
      ctx.save();
      ctx.strokeStyle = "rgba(76, 139, 245, 0.4)";
      ctx.fillStyle = "rgba(76, 139, 245, 0.08)";
      ctx.lineWidth = 1 / zoom;
      ctx.fillRect(
        lassoSelection.startX,
        lassoSelection.startY,
        lassoSelection.endX - lassoSelection.startX,
        lassoSelection.endY - lassoSelection.startY,
      );
      ctx.strokeRect(
        lassoSelection.startX,
        lassoSelection.startY,
        lassoSelection.endX - lassoSelection.startX,
        lassoSelection.endY - lassoSelection.startY,
      );
      ctx.restore();
    }

    ctx.restore();
  }, [
    elements,
    previewRect,
    selectedIds,
    pan,
    zoom,
    lassoSelection,
    strokeColor,
    bgColor,
    strokeWidth,
    opacity,
    activeTool,
    cropTarget,
    strokeType,
    roughness,
    snapIndicator,
    gridType,
  ]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onDoubleClick={handleDoubleClick}
        style={{
          display: "block",
          cursor:
            activeTool === "lock"
              ? "not-allowed"
              : isPanning || spacePressed || activeTool === "pan"
                ? "grab"
                : activeTool === "select"
                  ? "default"
                  : "crosshair",
          background: "#ffffff",
        }}
      />

      {editorOverlay.visible && (
        <textarea
          ref={permanentTextAreaRef}
          className="text-editor"
          style={{
            position: "absolute",
            left: editorOverlay.x * zoom + pan.x,
            top: editorOverlay.y * zoom + pan.y,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            opacity: opacity / 100,
            color: strokeColor,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            overflow: "hidden",
            font: `${getNumericStrokeWidth(strokeWidth, "text")}px Arial`,
            lineHeight: `${getNumericStrokeWidth(strokeWidth, "text") * 1.2}px`,
            whiteSpace: "pre-wrap",
          }}
          value={editorOverlay.value}
          onChange={(e) =>
            setEditorOverlay({ ...editorOverlay, value: e.target.value })
          }
          onBlur={commitTextAreaValue}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              commitTextAreaValue();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setEditorOverlay({
                visible: false,
                x: 0,
                y: 0,
                value: "",
                editingId: null,
              });
            }
          }}
        />
      )}

      {cropTarget && imageCache.current[cropTarget.id] && (
        <div
          style={{
            position: "absolute",
            left: cropTarget.x * zoom + pan.x,
            top: cropTarget.y * zoom + pan.y,
            width: cropTarget.width * zoom,
            height: cropTarget.height * zoom,
            border: "2px dashed #4c8bf5",
            boxSizing: "border-box",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -35,
              left: 0,
              display: "flex",
              gap: "6px",
            }}
          >
            <button
              onClick={executeCropCommit}
              style={{
                background: "#4c8bf5",
                color: "white",
                border: "none",
                padding: "4px 8px",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Apply Crop
            </button>
            <button
              onClick={() => setCropTarget(null)}
              style={{
                background: "#f44336",
                color: "white",
                border: "none",
                padding: "4px 8px",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Cancel
            </button>
          </div>
          <div
            style={{
              position: "absolute",
              bottom: -50,
              left: 0,
              background: "white",
              padding: "6px",
              borderRadius: "4px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
            }}
          >
            <label style={{ fontSize: "10px", color: "#666" }}>
              Crop Margins:
            </label>
            <input
              type="range"
              min="0"
              max={imageCache.current[cropTarget.id].width - 50}
              value={cropBox.x}
              onChange={(e) => {
                const newX = parseInt(e.target.value);
                setCropBox((prev) => ({
                  ...prev,
                  x: newX,
                  width: Math.min(
                    prev.width,
                    imageCache.current[cropTarget.id].width - newX,
                  ),
                }));
              }}
            />
            <input
              type="range"
              min="50"
              max={imageCache.current[cropTarget.id].width}
              value={cropBox.width}
              onChange={(e) =>
                setCropBox((prev) => ({
                  ...prev,
                  width: Math.min(
                    parseInt(e.target.value),
                    imageCache.current[cropTarget.id].width - prev.x,
                  ),
                }))
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
