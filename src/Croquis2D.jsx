import { useEffect, useMemo, useRef, useState } from "react";

const CANVAS_SIZE = 700;
const DEFAULT_SCALE = 30;
const SNAP_DEGREES = 5;
const DEFAULT_GAUGE = 24;
const SHAPE_VISIBLE_RATIO = 0.55;
const SHARED_POINT_TOLERANCE = 10;

const DEFAULT_VIEWBOX = {
  x: 0,
  y: 0,
  size: CANVAS_SIZE,
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function gaugeToStroke(gauge) {
  const max = 10;
  const min = 1.5;
  const ratio = (28 - gauge) / (28 - 12);
  return min + ratio * (max - min);
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function normalizeAngle(angle) {
  let a = angle % 360;
  if (a < 0) a += 360;
  return a;
}

function signedAngleDifference(a1, a2) {
  return ((a2 - a1 + 540) % 360) - 180;
}

function getLineLengthInches(line, scale) {
  return (
    Math.round(
      (distance(line.x1, line.y1, line.x2, line.y2) / scale) * 100
    ) / 100
  );
}

function getLineAngleDeg(line) {
  const angle = radToDeg(Math.atan2(line.y1 - line.y2, line.x2 - line.x1));
  return Math.round(normalizeAngle(angle) * 10) / 10;
}

function getLineCenter(line) {
  return {
    x: (line.x1 + line.x2) / 2,
    y: (line.y1 + line.y2) / 2,
  };
}

function getAnglePairKey(lineId1, lineId2) {
  return [lineId1, lineId2].sort().join("__");
}

function findSharedPoint(l1, l2) {
  const points1 = [
    { x: l1.x1, y: l1.y1 },
    { x: l1.x2, y: l1.y2 },
  ];

  const points2 = [
    { x: l2.x1, y: l2.y1 },
    { x: l2.x2, y: l2.y2 },
  ];

  let best = null;

  for (const p1 of points1) {
    for (const p2 of points2) {
      const d = distance(p1.x, p1.y, p2.x, p2.y);

      if (!best || d < best.distance) {
        best = {
          p1,
          p2,
          distance: d,
        };
      }
    }
  }

  if (!best || best.distance > SHARED_POINT_TOLERANCE) {
    return null;
  }

  return {
    x: (best.p1.x + best.p2.x) / 2,
    y: (best.p1.y + best.p2.y) / 2,
  };
}

function forceLinesToStayConnected(lines) {
  if (lines.length <= 1) return lines;

  const connected = [...lines];

  for (let i = 1; i < connected.length; i++) {
    const previousLine = connected[i - 1];
    const currentLine = connected[i];

    const lengthPx = distance(
      currentLine.x1,
      currentLine.y1,
      currentLine.x2,
      currentLine.y2
    );

    const angle = getLineAngleDeg(currentLine);
    const radians = degToRad(angle);

    connected[i] = {
      ...currentLine,
      x1: previousLine.x2,
      y1: previousLine.y2,
      x2: previousLine.x2 + Math.cos(radians) * lengthPx,
      y2: previousLine.y2 - Math.sin(radians) * lengthPx,
    };
  }

  return connected;
}

function getVectorAwayFromVertex(line, vertex) {
  const d1 = distance(vertex.x, vertex.y, line.x1, line.y1);
  const d2 = distance(vertex.x, vertex.y, line.x2, line.y2);

  const farPoint =
    d1 > d2
      ? { x: line.x1, y: line.y1 }
      : { x: line.x2, y: line.y2 };

  const len = distance(vertex.x, vertex.y, farPoint.x, farPoint.y);

  if (len <= 0) {
    return { x: 1, y: 0 };
  }

  return {
    x: (farPoint.x - vertex.x) / len,
    y: (farPoint.y - vertex.y) / len,
  };
}

function getAngleBetweenLinesAtVertex(l1, l2) {
  const vertex = findSharedPoint(l1, l2);

  if (!vertex) return null;

  const v1 = getVectorAwayFromVertex(l1, vertex);
  const v2 = getVectorAwayFromVertex(l2, vertex);

  const dot = clamp(v1.x * v2.x + v1.y * v2.y, -1, 1);
  const angle = radToDeg(Math.acos(dot));

  return Math.round(angle * 10) / 10;
}

function getAngleLabelDefaultPosition(l1, l2, viewBox) {
  const vertex = findSharedPoint(l1, l2);

  if (!vertex) return null;

  const v1 = getVectorAwayFromVertex(l1, vertex);
  const v2 = getVectorAwayFromVertex(l2, vertex);

  let bisector = {
    x: v1.x + v2.x,
    y: v1.y + v2.y,
  };

  const bisectorLength = Math.hypot(bisector.x, bisector.y);

  if (bisectorLength < 0.001) {
    bisector = {
      x: -v1.y,
      y: v1.x,
    };
  } else {
    bisector = {
      x: bisector.x / bisectorLength,
      y: bisector.y / bisectorLength,
    };
  }

  const offset = Math.max(28, Math.min(viewBox.size * 0.075, 70));

  return {
    x: vertex.x + bisector.x * offset,
    y: vertex.y + bisector.y * offset,
  };
}

function snapAngle(angle) {
  const normalized = normalizeAngle(angle);
  const snapTargets = [0, 90, 180, 270, 360];

  for (const target of snapTargets) {
    if (Math.abs(normalized - target) <= SNAP_DEGREES) {
      return target === 360 ? 0 : target;
    }
  }

  return normalized;
}

function getSnappedPoint(x1, y1, x2, y2) {
  const rawLength = distance(x1, y1, x2, y2);

  if (rawLength <= 0) {
    return { x: x2, y: y2 };
  }

  const rawAngle = radToDeg(Math.atan2(y1 - y2, x2 - x1));
  const snappedAngle = snapAngle(rawAngle);
  const radians = degToRad(snappedAngle);

  return {
    x: x1 + Math.cos(radians) * rawLength,
    y: y1 - Math.sin(radians) * rawLength,
  };
}

function rebuildConnectedLines(lines, changedIndex, newChangedLine) {
  const rebuilt = [...lines];

  rebuilt[changedIndex] = newChangedLine;

  for (let i = changedIndex + 1; i < rebuilt.length; i++) {
    const previousLine = rebuilt[i - 1];
    const currentLine = rebuilt[i];

    const currentLengthPx = distance(
      currentLine.x1,
      currentLine.y1,
      currentLine.x2,
      currentLine.y2
    );

    const currentAngle = getLineAngleDeg(currentLine);
    const radians = degToRad(currentAngle);

    rebuilt[i] = {
      ...currentLine,
      x1: previousLine.x2,
      y1: previousLine.y2,
      x2: previousLine.x2 + Math.cos(radians) * currentLengthPx,
      y2: previousLine.y2 - Math.sin(radians) * currentLengthPx,
    };
  }

  return forceLinesToStayConnected(rebuilt);
}

function getDrawingBounds(lines) {
  if (lines.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: CANVAS_SIZE,
      maxY: CANVAS_SIZE,
    };
  }

  const points = [];

  lines.forEach((line) => {
    points.push({ x: line.x1, y: line.y1 });
    points.push({ x: line.x2, y: line.y2 });
  });

  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

function getAutoViewBox(lines) {
  if (lines.length === 0) {
    return DEFAULT_VIEWBOX;
  }

  const bounds = getDrawingBounds(lines);

  const drawingWidth = Math.max(bounds.maxX - bounds.minX, 40);
  const drawingHeight = Math.max(bounds.maxY - bounds.minY, 40);

  const maxSide = Math.max(drawingWidth, drawingHeight);
  const viewSide = Math.max(maxSide / SHAPE_VISIBLE_RATIO, 220);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: centerX - viewSide / 2,
    y: centerY - viewSide / 2,
    size: viewSide,
  };
}

function makeGridLines(viewBox) {
  const gridLines = [];
  const smallStep = 20;
  const bigStep = 100;

  const startX = Math.floor(viewBox.x / smallStep) * smallStep;
  const endX = viewBox.x + viewBox.size;

  const startY = Math.floor(viewBox.y / smallStep) * smallStep;
  const endY = viewBox.y + viewBox.size;

  for (let x = startX; x <= endX; x += smallStep) {
    gridLines.push({
      id: `v-${x}`,
      x1: x,
      y1: viewBox.y,
      x2: x,
      y2: viewBox.y + viewBox.size,
      big: x % bigStep === 0,
    });
  }

  for (let y = startY; y <= endY; y += smallStep) {
    gridLines.push({
      id: `h-${y}`,
      x1: viewBox.x,
      y1: y,
      x2: viewBox.x + viewBox.size,
      y2: y,
      big: y % bigStep === 0,
    });
  }

  return gridLines;
}

function boxesOverlap(a, b) {
  const margin = 6;

  return !(
    a.x + a.width + margin < b.x ||
    b.x + b.width + margin < a.x ||
    a.y + a.height + margin < b.y ||
    b.y + b.height + margin < a.y
  );
}

function lineIntersectsBox(line, box) {
  const padding = 8;

  const expandedBox = {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };

  const minLineX = Math.min(line.x1, line.x2);
  const maxLineX = Math.max(line.x1, line.x2);
  const minLineY = Math.min(line.y1, line.y2);
  const maxLineY = Math.max(line.y1, line.y2);

  const lineBox = {
    x: minLineX,
    y: minLineY,
    width: Math.max(maxLineX - minLineX, 1),
    height: Math.max(maxLineY - minLineY, 1),
  };

  return boxesOverlap(expandedBox, lineBox);
}

function getDimensionFontSize(viewBox) {
  const wantedScreenPx = 24;
  const worldSize = (wantedScreenPx * viewBox.size) / CANVAS_SIZE;

  return Math.max(9, Math.min(worldSize, 32));
}

function getAngleFontSize(viewBox) {
  const wantedScreenPx = 26;
  const worldSize = (wantedScreenPx * viewBox.size) / CANVAS_SIZE;

  return Math.max(10, Math.min(worldSize, 34));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampLabelInsideView(label, viewBox) {
  const margin = viewBox.size * 0.035;

  const minX = viewBox.x + margin;
  const maxX = viewBox.x + viewBox.size - margin;
  const minY = viewBox.y + margin;
  const maxY = viewBox.y + viewBox.size - margin;

  const clampedX = clamp(label.x, minX, maxX);
  const clampedY = clamp(label.y, minY, maxY);

  const dx = clampedX - label.x;
  const dy = clampedY - label.y;

  return {
    ...label,
    x: clampedX,
    y: clampedY,
    box: {
      ...label.box,
      x: label.box.x + dx,
      y: label.box.y + dy,
    },
  };
}

function makeDimensionLabels(lines, scale, viewBox, dimensionPositions) {
  const placedBoxes = [];
  const fontSize = getDimensionFontSize(viewBox);

  return lines.map((line, index) => {
    const center = getLineCenter(line);
    const customPosition = dimensionPositions[line.id];

    const text = `${getLineLengthInches(line, scale)}"`;
    const width = text.length * fontSize * 0.82;
    const height = fontSize * 1.35;

    if (customPosition) {
      const label = {
        id: line.id,
        lineIndex: index,
        text,
        x: customPosition.x,
        y: customPosition.y,
        fontSize,
        box: {
          x: customPosition.x - width / 2,
          y: customPosition.y - height / 2,
          width,
          height,
        },
      };

      return clampLabelInsideView(label, viewBox);
    }

    const lineLength = distance(line.x1, line.y1, line.x2, line.y2);

    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;

    const normal =
      lineLength > 0
        ? {
            x: -dy / lineLength,
            y: dx / lineLength,
          }
        : {
            x: 0,
            y: -1,
          };

    let chosen = null;

    const offsetOptions = [
      -42,
      42,
      -60,
      60,
      -82,
      82,
      -108,
      108,
      -138,
      138,
      -172,
      172,
      -210,
      210,
    ];

    for (const offset of offsetOptions) {
      const x = center.x + normal.x * offset;
      const y = center.y + normal.y * offset;

      const box = {
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
      };

      const hasOverlap = placedBoxes.some((existing) =>
        boxesOverlap(box, existing)
      );

      const touchesAnyLine = lines.some((existingLine) =>
        lineIntersectsBox(existingLine, box)
      );

      if (!hasOverlap && !touchesAnyLine) {
        chosen = {
          id: line.id,
          lineIndex: index,
          text,
          x,
          y,
          fontSize,
          box,
        };

        placedBoxes.push(box);
        break;
      }
    }

    if (!chosen) {
      const offset = index % 2 === 0 ? -240 : 240;

      const x = center.x + normal.x * offset;
      const y = center.y + normal.y * offset;

      chosen = {
        id: line.id,
        lineIndex: index,
        text,
        x,
        y,
        fontSize,
        box: {
          x: x - width / 2,
          y: y - height / 2,
          width,
          height,
        },
      };

      placedBoxes.push(chosen.box);
    }

    return clampLabelInsideView(chosen, viewBox);
  });
}

function getTouchDistance(touches) {
  if (touches.length < 2) return 0;

  const t1 = touches[0];
  const t2 = touches[1];

  return distance(t1.clientX, t1.clientY, t2.clientX, t2.clientY);
}

function getTouchCenter(touches) {
  if (touches.length < 2) return null;

  const t1 = touches[0];
  const t2 = touches[1];

  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

export default function Croquis2D() {
  const svgRef = useRef(null);

  const [mode, setMode] = useState("creer");

  const [lines, setLines] = useState([]);
  const [currentLine, setCurrentLine] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [selectedLineId, setSelectedLineId] = useState(null);
  const [hoveredLineId, setHoveredLineId] = useState(null);

  const [draggingDimensionId, setDraggingDimensionId] = useState(null);
  const [dimensionPositions, setDimensionPositions] = useState({});

  const [angleMode, setAngleMode] = useState(false);
  const [selectedAngleLineIds, setSelectedAngleLineIds] = useState([]);
  const [selectedAngleId, setSelectedAngleId] = useState(null);
  const [draggingAngleId, setDraggingAngleId] = useState(null);
  const [angleLabels, setAngleLabels] = useState([]);

  const [savedSketches, setSavedSketches] = useState([]);

  const [manualViewBox, setManualViewBox] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState(null);
  const [lastTouchInfo, setLastTouchInfo] = useState(null);

  const scale = DEFAULT_SCALE;

  const selectedLine = useMemo(() => {
    return lines.find((line) => line.id === selectedLineId) || null;
  }, [lines, selectedLineId]);

  const selectedAngle = useMemo(() => {
    return angleLabels.find((angle) => angle.id === selectedAngleId) || null;
  }, [angleLabels, selectedAngleId]);

  const selectedAngleValue = useMemo(() => {
    if (!selectedAngle) return "";

    const l1 = lines.find((line) => line.id === selectedAngle.lineIds[0]);
    const l2 = lines.find((line) => line.id === selectedAngle.lineIds[1]);

    if (!l1 || !l2) return "";

    if (
      selectedAngle.lockedValue !== null &&
      selectedAngle.lockedValue !== undefined
    ) {
      return selectedAngle.lockedValue;
    }

    const value = getAngleBetweenLinesAtVertex(l1, l2);

    return value === null ? "" : value;
  }, [selectedAngle, lines]);

  const selectedLength = selectedLine
    ? getLineLengthInches(selectedLine, scale)
    : "";

  const autoViewBox = useMemo(() => {
    return getAutoViewBox(lines);
  }, [lines]);

  const baseViewBox = mode === "dimensions" ? autoViewBox : DEFAULT_VIEWBOX;
  const activeViewBox = manualViewBox || baseViewBox;

  const gridLines = useMemo(() => {
    return makeGridLines(activeViewBox);
  }, [activeViewBox]);

  const dimensionLabels = useMemo(() => {
    return makeDimensionLabels(lines, scale, activeViewBox, dimensionPositions);
  }, [lines, scale, activeViewBox, dimensionPositions]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const zoomFactor = e.deltaY > 0 ? 1.12 : 0.88;
      zoomAt(e.clientX, e.clientY, zoomFactor);
    };

    svg.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      svg.removeEventListener("wheel", onWheel);
    };
  });

  function getMousePoint(e) {
    const rect = svgRef.current.getBoundingClientRect();

    return {
      x:
        activeViewBox.x +
        ((e.clientX - rect.left) / rect.width) * activeViewBox.size,
      y:
        activeViewBox.y +
        ((e.clientY - rect.top) / rect.height) * activeViewBox.size,
    };
  }

  function getScreenPointAsWorld(clientX, clientY, viewBox = activeViewBox) {
    const rect = svgRef.current.getBoundingClientRect();

    return {
      x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.size,
      y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.size,
    };
  }

  function zoomAt(clientX, clientY, zoomFactor) {
    const currentViewBox = manualViewBox || activeViewBox;
    const before = getScreenPointAsWorld(clientX, clientY, currentViewBox);

    const newSize = clamp(currentViewBox.size * zoomFactor, 80, 5000);

    const rect = svgRef.current.getBoundingClientRect();
    const mouseRatioX = (clientX - rect.left) / rect.width;
    const mouseRatioY = (clientY - rect.top) / rect.height;

    const newX = before.x - mouseRatioX * newSize;
    const newY = before.y - mouseRatioY * newSize;

    setManualViewBox({
      x: newX,
      y: newY,
      size: newSize,
    });
  }

  function handleContextMenu(e) {
    e.preventDefault();
  }

  function clearSelectionIfBackground(e) {
    if (e.target.tagName !== "rect") return;

    setSelectedLineId(null);
    setSelectedAngleId(null);
    setHoveredLineId(null);
    setAngleMode(false);
    setSelectedAngleLineIds([]);
  }

  function handleMouseDown(e) {
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({
        x: e.clientX,
        y: e.clientY,
      });
      return;
    }

    if (mode !== "creer") return;
    if (e.button !== 0) return;

    const point = getMousePoint(e);

    const startPoint =
      lines.length > 0
        ? {
            x: lines[lines.length - 1].x2,
            y: lines[lines.length - 1].y2,
          }
        : point;

    const newLine = {
      id: makeId(),
      x1: startPoint.x,
      y1: startPoint.y,
      x2: startPoint.x,
      y2: startPoint.y,
      gauge: DEFAULT_GAUGE,
    };

    setCurrentLine(newLine);
    setIsDrawing(true);
    setSelectedLineId(null);
    setSelectedAngleId(null);
  }

  function handleMouseMove(e) {
    if (isPanning && lastPanPoint) {
      const currentViewBox = manualViewBox || activeViewBox;

      const dxScreen = e.clientX - lastPanPoint.x;
      const dyScreen = e.clientY - lastPanPoint.y;

      const rect = svgRef.current.getBoundingClientRect();

      const dxWorld = (dxScreen / rect.width) * currentViewBox.size;
      const dyWorld = (dyScreen / rect.height) * currentViewBox.size;

      setManualViewBox({
        ...currentViewBox,
        x: currentViewBox.x - dxWorld,
        y: currentViewBox.y - dyWorld,
      });

      setLastPanPoint({
        x: e.clientX,
        y: e.clientY,
      });

      return;
    }

    if (draggingAngleId) {
      const point = getMousePoint(e);

      setAngleLabels((prev) =>
        prev.map((angle) => {
          if (angle.id !== draggingAngleId) return angle;

          return {
            ...angle,
            x: point.x,
            y: point.y,
            moved: true,
          };
        })
      );

      return;
    }

    if (draggingDimensionId) {
      const point = getMousePoint(e);

      setDimensionPositions((prev) => ({
        ...prev,
        [draggingDimensionId]: {
          x: point.x,
          y: point.y,
        },
      }));

      return;
    }

    if (mode !== "creer") return;
    if (!isDrawing || !currentLine) return;

    const point = getMousePoint(e);

    const snappedPoint = getSnappedPoint(
      currentLine.x1,
      currentLine.y1,
      point.x,
      point.y
    );

    setCurrentLine((prev) => ({
      ...prev,
      x2: snappedPoint.x,
      y2: snappedPoint.y,
    }));
  }

  function finishDrawingLine() {
    if (mode !== "creer") return;
    if (!isDrawing || !currentLine) return;

    const lineLength = distance(
      currentLine.x1,
      currentLine.y1,
      currentLine.x2,
      currentLine.y2
    );

    if (lineLength > 5) {
      setLines((prev) => forceLinesToStayConnected([...prev, currentLine]));
    }

    setCurrentLine(null);
    setIsDrawing(false);
  }

  function handleMouseUp(e) {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    if (draggingAngleId) {
      setDraggingAngleId(null);
      return;
    }

    if (draggingDimensionId) {
      setDraggingDimensionId(null);
      return;
    }

    if (e.button !== 0) return;
    finishDrawingLine();
  }

  function handleMouseLeave() {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    if (draggingAngleId) {
      setDraggingAngleId(null);
      return;
    }

    if (draggingDimensionId) {
      setDraggingDimensionId(null);
      return;
    }

    setHoveredLineId(null);
    finishDrawingLine();
  }

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();

      const center = getTouchCenter(e.touches);
      const dist = getTouchDistance(e.touches);

      setLastTouchInfo({
        center,
        dist,
        viewBox: manualViewBox || activeViewBox,
      });
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length !== 2 || !lastTouchInfo) return;

    e.preventDefault();

    const newCenter = getTouchCenter(e.touches);
    const newDist = getTouchDistance(e.touches);

    if (!newCenter || !newDist) return;

    const zoomFactor = lastTouchInfo.dist / newDist;

    const oldViewBox = lastTouchInfo.viewBox;
    const newSize = clamp(oldViewBox.size * zoomFactor, 80, 5000);

    const rect = svgRef.current.getBoundingClientRect();

    const oldCenterWorld = {
      x:
        oldViewBox.x +
        ((lastTouchInfo.center.x - rect.left) / rect.width) * oldViewBox.size,
      y:
        oldViewBox.y +
        ((lastTouchInfo.center.y - rect.top) / rect.height) * oldViewBox.size,
    };

    const newRatioX = (newCenter.x - rect.left) / rect.width;
    const newRatioY = (newCenter.y - rect.top) / rect.height;

    setManualViewBox({
      x: oldCenterWorld.x - newRatioX * newSize,
      y: oldCenterWorld.y - newRatioY * newSize,
      size: newSize,
    });
  }

  function handleTouchEnd() {
    setLastTouchInfo(null);
  }

  function handleLineClick(e, lineId) {
    e.stopPropagation();

    if (mode !== "dimensions") return;

    if (angleMode) {
      handleAngleLineSelection(lineId);
      return;
    }

    const line = lines.find((item) => item.id === lineId);
    if (!line) return;

    setSelectedLineId(lineId);
    setSelectedAngleId(null);
  }

  function handleAngleLineSelection(lineId) {
    setSelectedLineId(lineId);
    setSelectedAngleId(null);

    setSelectedAngleLineIds((prev) => {
      if (prev.includes(lineId)) {
        return prev;
      }

      const next = [...prev, lineId];

      if (next.length === 2) {
        createAngleLabel(next[0], next[1]);
        setAngleMode(false);
        return [];
      }

      return next;
    });
  }

  function createAngleLabel(lineId1, lineId2) {
    const l1 = lines.find((line) => line.id === lineId1);
    const l2 = lines.find((line) => line.id === lineId2);

    if (!l1 || !l2) return;

    const vertex = findSharedPoint(l1, l2);

    if (!vertex) {
      alert("Choisis deux lignes qui se touchent au même coin.");
      return;
    }

    const pairKey = getAnglePairKey(lineId1, lineId2);

    const alreadyExists = angleLabels.some(
      (angle) => angle.pairKey === pairKey
    );

    if (alreadyExists) {
      alert("Cet angle existe déjà entre ces deux lignes.");
      return;
    }

    const pos = getAngleLabelDefaultPosition(l1, l2, activeViewBox);
    const currentValue = getAngleBetweenLinesAtVertex(l1, l2);

    if (!pos || currentValue === null) return;

    const newAngle = {
      id: makeId(),
      pairKey,
      lineIds: [lineId1, lineId2],
      x: pos.x,
      y: pos.y,
      moved: false,
      lockedValue: currentValue,
    };

    setAngleLabels((prev) => [...prev, newAngle]);
    setSelectedAngleId(newAngle.id);
    setSelectedLineId(null);
  }

  function startAngleMode() {
    setMode("dimensions");
    setCurrentLine(null);
    setIsDrawing(false);
    setSelectedLineId(null);
    setSelectedAngleId(null);
    setSelectedAngleLineIds([]);
    setAngleMode(true);
  }

  function cancelAngleMode() {
    setAngleMode(false);
    setSelectedAngleLineIds([]);
  }

  function handleDimensionMouseDown(e, lineId) {
    if (mode !== "dimensions") return;

    e.stopPropagation();
    e.preventDefault();

    setSelectedLineId(lineId);
    setSelectedAngleId(null);
    setDraggingDimensionId(lineId);
  }

  function handleAngleMouseDown(e, angleId) {
    if (mode !== "dimensions") return;

    e.stopPropagation();
    e.preventDefault();

    setSelectedAngleId(angleId);
    setSelectedLineId(null);
    setDraggingAngleId(angleId);
  }

  function rotateLineAroundVertex(line, vertex, targetAngle) {
    const dStart = distance(vertex.x, vertex.y, line.x1, line.y1);
    const dEnd = distance(vertex.x, vertex.y, line.x2, line.y2);

    const pivotIsStart = dStart <= dEnd;
    const lengthPx = Math.max(dStart, dEnd);
    const radians = degToRad(targetAngle);

    if (pivotIsStart) {
      return {
        ...line,
        x1: vertex.x,
        y1: vertex.y,
        x2: vertex.x + Math.cos(radians) * lengthPx,
        y2: vertex.y - Math.sin(radians) * lengthPx,
      };
    }

    return {
      ...line,
      x2: vertex.x,
      y2: vertex.y,
      x1: vertex.x + Math.cos(radians) * lengthPx,
      y1: vertex.y - Math.sin(radians) * lengthPx,
    };
  }

  function applyAngleConstraint(
    sourceLines,
    angle,
    forcedValue = null,
    fixedLineId = null
  ) {
    const l1Index = sourceLines.findIndex(
      (line) => line.id === angle.lineIds[0]
    );
    const l2Index = sourceLines.findIndex(
      (line) => line.id === angle.lineIds[1]
    );

    if (l1Index === -1 || l2Index === -1) return sourceLines;

    const l1 = sourceLines[l1Index];
    const l2 = sourceLines[l2Index];

    const vertex = findSharedPoint(l1, l2);
    if (!vertex) return sourceLines;

    const lockedValue =
      forcedValue !== null && forcedValue !== undefined
        ? forcedValue
        : angle.lockedValue;

    if (lockedValue === null || lockedValue === undefined) return sourceLines;

    const fixedLine =
      fixedLineId === l1.id
        ? l1
        : fixedLineId === l2.id
        ? l2
        : l1;

    const movingLine = fixedLine.id === l1.id ? l2 : l1;
    const movingIndex = fixedLine.id === l1.id ? l2Index : l1Index;

    const fixedVector = getVectorAwayFromVertex(fixedLine, vertex);
    const movingVector = getVectorAwayFromVertex(movingLine, vertex);

    const fixedAngle = radToDeg(Math.atan2(-fixedVector.y, fixedVector.x));
    const movingAngle = radToDeg(Math.atan2(-movingVector.y, movingVector.x));

    const signedDiff = signedAngleDifference(fixedAngle, movingAngle);
    const direction = signedDiff >= 0 ? 1 : -1;

    const targetAngle = normalizeAngle(fixedAngle + direction * lockedValue);

    const newMovingLine = rotateLineAroundVertex(
      movingLine,
      vertex,
      targetAngle
    );

    const nextLines = [...sourceLines];
    nextLines[movingIndex] = newMovingLine;

    return rebuildConnectedLines(nextLines, movingIndex, newMovingLine);
  }

  function applyAngleConstraintsForLine(sourceLines, fixedLineId) {
    let updatedLines = forceLinesToStayConnected(sourceLines);

    const relatedAngles = angleLabels.filter((angle) =>
      angle.lineIds.includes(fixedLineId)
    );

    relatedAngles.forEach((angle) => {
      updatedLines = applyAngleConstraint(
        updatedLines,
        angle,
        angle.lockedValue,
        fixedLineId
      );
    });

    return forceLinesToStayConnected(updatedLines);
  }

  function updateSelectedLineLength(newLength) {
    if (!selectedLine) return;

    const lengthNumber = Number(newLength);

    if (!lengthNumber || lengthNumber <= 0) return;

    setLines((prev) => {
      const connectedPrev = forceLinesToStayConnected(prev);

      const index = connectedPrev.findIndex(
        (line) => line.id === selectedLine.id
      );

      if (index === -1) return connectedPrev;

      const line = connectedPrev[index];
      const angle = getLineAngleDeg(line);
      const radians = degToRad(angle);

      const newLine = {
        ...line,
        x2: line.x1 + Math.cos(radians) * lengthNumber * scale,
        y2: line.y1 - Math.sin(radians) * lengthNumber * scale,
      };

      const rebuilt = rebuildConnectedLines(connectedPrev, index, newLine);

      return applyAngleConstraintsForLine(rebuilt, selectedLine.id);
    });
  }

  function updateSelectedAngle(newAngleValue) {
    if (!selectedAngle) return;

    const angleNumber = Number(newAngleValue);

    if (Number.isNaN(angleNumber)) return;

    const cleanAngle = clamp(angleNumber, 0, 180);

    setAngleLabels((prev) =>
      prev.map((angle) =>
        angle.id === selectedAngle.id
          ? {
              ...angle,
              lockedValue: cleanAngle,
            }
          : angle
      )
    );

    setLines((prev) => {
      const connectedPrev = forceLinesToStayConnected(prev);
      const updated = applyAngleConstraint(
        connectedPrev,
        selectedAngle,
        cleanAngle
      );

      return forceLinesToStayConnected(updated);
    });
  }

  function deleteSelectedAngle() {
    if (!selectedAngle) return;

    setAngleLabels((prev) =>
      prev.filter((angle) => angle.id !== selectedAngle.id)
    );

    setSelectedAngleId(null);
  }

  function deleteSelectedLine() {
    if (!selectedLine) return;

    setLines((prev) => {
      const connectedPrev = forceLinesToStayConnected(prev);

      const index = connectedPrev.findIndex(
        (line) => line.id === selectedLine.id
      );

      if (index === -1) return connectedPrev;

      const nextLines = connectedPrev.filter(
        (line) => line.id !== selectedLine.id
      );

      return forceLinesToStayConnected(nextLines);
    });

    setDimensionPositions((prev) => {
      const updated = { ...prev };
      delete updated[selectedLine.id];
      return updated;
    });

    setAngleLabels((prev) =>
      prev.filter((angle) => !angle.lineIds.includes(selectedLine.id))
    );

    setSelectedAngleLineIds((prev) =>
      prev.filter((id) => id !== selectedLine.id)
    );

    setSelectedLineId(null);
    setSelectedAngleId(null);
  }

  function clearSketch() {
    setLines([]);
    setCurrentLine(null);
    setIsDrawing(false);
    setSelectedLineId(null);
    setHoveredLineId(null);
    setDraggingDimensionId(null);
    setDimensionPositions({});
    setAngleMode(false);
    setSelectedAngleLineIds([]);
    setSelectedAngleId(null);
    setDraggingAngleId(null);
    setAngleLabels([]);
    setManualViewBox(null);
    setIsPanning(false);
    setLastPanPoint(null);
    setLastTouchInfo(null);
  }

  function resetView() {
    setManualViewBox(null);
  }

  function saveSketch() {
    if (lines.length === 0) {
      alert("Dessine au moins une ligne avant de sauvegarder.");
      return;
    }

    const connectedLines = forceLinesToStayConnected(lines);

    const totalLength = connectedLines.reduce((sum, line) => {
      return sum + getLineLengthInches(line, scale);
    }, 0);

    const sketch = {
      id: makeId(),
      name: `Croquis ${savedSketches.length + 1}`,
      date: new Date().toLocaleString("fr-CA"),
      lines: JSON.parse(JSON.stringify(connectedLines)),
      dimensionPositions: JSON.parse(JSON.stringify(dimensionPositions)),
      angleLabels: JSON.parse(JSON.stringify(angleLabels)),
      totalLength: Math.round(totalLength * 100) / 100,
    };

    setSavedSketches((prev) => [sketch, ...prev]);
    setLines(connectedLines);
  }

  function loadSketch(sketch) {
    setLines(forceLinesToStayConnected(JSON.parse(JSON.stringify(sketch.lines))));
    setDimensionPositions(
      JSON.parse(JSON.stringify(sketch.dimensionPositions || {}))
    );
    setAngleLabels(
      JSON.parse(
        JSON.stringify(
          (sketch.angleLabels || []).map((angle) => ({
            ...angle,
            pairKey:
              angle.pairKey ||
              getAnglePairKey(angle.lineIds?.[0] || "", angle.lineIds?.[1] || ""),
            lockedValue:
              angle.lockedValue !== null && angle.lockedValue !== undefined
                ? angle.lockedValue
                : null,
          }))
        )
      )
    );
    setSelectedLineId(null);
    setHoveredLineId(null);
    setDraggingDimensionId(null);
    setSelectedAngleId(null);
    setDraggingAngleId(null);
    setAngleMode(false);
    setSelectedAngleLineIds([]);
    setManualViewBox(null);
    setMode("dimensions");
  }

  function deleteSavedSketch(id) {
    setSavedSketches((prev) => prev.filter((sketch) => sketch.id !== id));
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Croquis 2D</h1>
        <p style={styles.subtitle}>
          Roulette ou 2 doigts pour zoomer. Clic droit tenu pour déplacer la vue.
        </p>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.canvasCard}>
          <div style={styles.canvasTopBar}>
            <div>
              <strong style={styles.canvasTitle}>Zone de dessin</strong>
              <span style={styles.smallText}>
                {mode === "creer"
                  ? lines.length === 0
                    ? "Clique gauche tenu + glisser pour créer la première ligne."
                    : "La prochaine ligne part automatiquement du bout de la dernière ligne."
                  : angleMode
                  ? "Clique sur deux lignes qui se touchent pour ajouter un angle."
                  : "Clique sur une ligne ou un angle pour le modifier. Les lignes restent attachées entre elles."}
              </span>
            </div>

            <div style={styles.topActions}>
              <button type="button" style={styles.resetButton} onClick={resetView}>
                Recentrer
              </button>

              <div style={styles.modeBadge}>
                Mode : {mode === "creer" ? "Créer" : "Dimensions"}
              </div>
            </div>
          </div>

          <svg
            ref={svgRef}
            viewBox={`${activeViewBox.x} ${activeViewBox.y} ${activeViewBox.size} ${activeViewBox.size}`}
            style={{
              ...styles.svg,
              cursor:
                mode === "creer"
                  ? "crosshair"
                  : isPanning
                  ? "grabbing"
                  : draggingDimensionId || draggingAngleId
                  ? "grabbing"
                  : "pointer",
            }}
            onClick={clearSelectionIfBackground}
            onContextMenu={handleContextMenu}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <rect
              x={activeViewBox.x}
              y={activeViewBox.y}
              width={activeViewBox.size}
              height={activeViewBox.size}
              fill="#ffffff"
            />

            {gridLines.map((gridLine) => (
              <line
                key={gridLine.id}
                x1={gridLine.x1}
                y1={gridLine.y1}
                x2={gridLine.x2}
                y2={gridLine.y2}
                stroke={gridLine.big ? "#cfd4dc" : "#e5e7eb"}
                strokeWidth={gridLine.big ? 1.5 : 1}
              />
            ))}

            {lines.map((line) => {
              const isSelected = selectedLineId === line.id;
              const isHovered = hoveredLineId === line.id;
              const isAngleSelected = selectedAngleLineIds.includes(line.id);
              const isInSelectedAngle =
                selectedAngle && selectedAngle.lineIds.includes(line.id);

              const strokeColor = isSelected
                ? "#0f62fe"
                : isInSelectedAngle
                ? "#f97316"
                : isAngleSelected
                ? "#f59e0b"
                : isHovered
                ? "#f97316"
                : "#111827";

              return (
                <g key={line.id}>
                  <line
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="transparent"
                    strokeWidth={gaugeToStroke(DEFAULT_GAUGE) + 18}
                    strokeLinecap="round"
                    onClick={(e) => handleLineClick(e, line.id)}
                    onMouseEnter={() => setHoveredLineId(line.id)}
                    onMouseLeave={() => setHoveredLineId(null)}
                    style={{
                      cursor: mode === "dimensions" ? "pointer" : "crosshair",
                    }}
                  />

                  <line
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={strokeColor}
                    strokeWidth={
                      isHovered || isSelected || isAngleSelected || isInSelectedAngle
                        ? gaugeToStroke(DEFAULT_GAUGE) + 3
                        : gaugeToStroke(DEFAULT_GAUGE)
                    }
                    strokeLinecap="round"
                    pointerEvents="none"
                  />

                  <circle
                    cx={line.x1}
                    cy={line.y1}
                    r={
                      isHovered || isSelected || isAngleSelected || isInSelectedAngle
                        ? 6
                        : 4
                    }
                    fill={strokeColor}
                    pointerEvents="none"
                  />

                  <circle
                    cx={line.x2}
                    cy={line.y2}
                    r={
                      isHovered || isSelected || isAngleSelected || isInSelectedAngle
                        ? 6
                        : 4
                    }
                    fill={strokeColor}
                    pointerEvents="none"
                  />
                </g>
              );
            })}

            {dimensionLabels.map((label) => {
              const isSelected = selectedLineId === label.id;
              const relatedLine = lines[label.lineIndex];
              const center = relatedLine ? getLineCenter(relatedLine) : label;

              return (
                <g key={`dim-${label.id}`}>
                  <line
                    x1={center.x}
                    y1={center.y}
                    x2={label.x}
                    y2={label.y}
                    stroke={isSelected ? "#16a34a" : "#22c55e"}
                    strokeWidth={isSelected ? 2 : 1.5}
                    strokeDasharray="6 5"
                    opacity={0.95}
                  />

                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={label.fontSize}
                    fontWeight={isSelected ? "900" : "800"}
                    fill="#16a34a"
                    onMouseDown={(e) => handleDimensionMouseDown(e, label.id)}
                    style={{
                      cursor: mode === "dimensions" ? "grab" : "default",
                      userSelect: "none",
                      paintOrder: "stroke",
                      stroke: "#ffffff",
                      strokeWidth: label.fontSize * 0.45,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                    }}
                  >
                    {label.text}
                  </text>
                </g>
              );
            })}

            {angleLabels.map((angle) => {
              const l1 = lines.find((line) => line.id === angle.lineIds[0]);
              const l2 = lines.find((line) => line.id === angle.lineIds[1]);

              if (!l1 || !l2) return null;

              const vertex = findSharedPoint(l1, l2);
              const measuredValue = getAngleBetweenLinesAtVertex(l1, l2);
              const defaultPos = getAngleLabelDefaultPosition(l1, l2, activeViewBox);

              if (!vertex || measuredValue === null || !defaultPos) return null;

              const labelX = angle.moved ? angle.x : defaultPos.x;
              const labelY = angle.moved ? angle.y : defaultPos.y;

              const value =
                angle.lockedValue !== null && angle.lockedValue !== undefined
                  ? angle.lockedValue
                  : measuredValue;

              const fontSize = getAngleFontSize(activeViewBox);
              const isSelected = selectedAngleId === angle.id;

              return (
                <g key={angle.id}>
                  <line
                    x1={vertex.x}
                    y1={vertex.y}
                    x2={labelX}
                    y2={labelY}
                    stroke={isSelected ? "#ea580c" : "#f97316"}
                    strokeWidth={isSelected ? 2.4 : 1.5}
                    strokeDasharray="6 5"
                  />

                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={fontSize}
                    fontWeight="900"
                    fill="#f97316"
                    onMouseDown={(e) => handleAngleMouseDown(e, angle.id)}
                    style={{
                      cursor: mode === "dimensions" ? "grab" : "default",
                      userSelect: "none",
                      paintOrder: "stroke",
                      stroke: "#ffffff",
                      strokeWidth: fontSize * 0.45,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                    }}
                  >
                    {value}°
                  </text>
                </g>
              );
            })}

            {currentLine && (
              <g>
                <line
                  x1={currentLine.x1}
                  y1={currentLine.y1}
                  x2={currentLine.x2}
                  y2={currentLine.y2}
                  stroke="#22c55e"
                  strokeWidth={gaugeToStroke(DEFAULT_GAUGE)}
                  strokeLinecap="round"
                  strokeDasharray="8 6"
                />

                <circle
                  cx={currentLine.x1}
                  cy={currentLine.y1}
                  r={4}
                  fill="#22c55e"
                />

                <circle
                  cx={currentLine.x2}
                  cy={currentLine.y2}
                  r={4}
                  fill="#22c55e"
                />

                <text
                  x={(currentLine.x1 + currentLine.x2) / 2}
                  y={(currentLine.y1 + currentLine.y2) / 2 - 15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={getDimensionFontSize(activeViewBox)}
                  fontWeight="900"
                  fill="#16a34a"
                  style={{
                    paintOrder: "stroke",
                    stroke: "#ffffff",
                    strokeWidth: getDimensionFontSize(activeViewBox) * 0.45,
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                  }}
                >
                  {getLineLengthInches(currentLine, scale)}"
                </text>
              </g>
            )}
          </svg>
        </div>

        <aside style={styles.sidePanel}>
          <h2 style={styles.panelTitle}>Outils</h2>

          <div style={styles.modeButtons}>
            <button
              type="button"
              onClick={() => {
                setMode("creer");
                setSelectedLineId(null);
                setSelectedAngleId(null);
                setHoveredLineId(null);
                setDraggingDimensionId(null);
                setDraggingAngleId(null);
                setAngleMode(false);
                setSelectedAngleLineIds([]);
              }}
              style={{
                ...styles.modeButton,
                ...(mode === "creer" ? styles.modeButtonActive : {}),
              }}
            >
              Créer
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("dimensions");
                setCurrentLine(null);
                setIsDrawing(false);
              }}
              style={{
                ...styles.modeButton,
                ...(mode === "dimensions" ? styles.modeButtonActive : {}),
              }}
            >
              Dimensions
            </button>
          </div>

          <div style={styles.separator} />

          {mode === "dimensions" ? (
            <div>
              <h3 style={styles.sectionTitle}>Modifier</h3>

              <button
                type="button"
                style={{
                  ...styles.angleButton,
                  ...(angleMode ? styles.angleButtonActive : {}),
                }}
                onClick={angleMode ? cancelAngleMode : startAngleMode}
              >
                {angleMode ? "Annuler l’angle" : "Ajouter un angle"}
              </button>

              {angleMode && (
                <div style={styles.angleHelp}>
                  Clique sur 2 lignes qui se touchent. Sélectionnées :{" "}
                  <strong>{selectedAngleLineIds.length}/2</strong>
                </div>
              )}

              {selectedAngle ? (
                <div style={styles.selectedBox}>
                  <label style={styles.label}>
                    Angle en degrés
                    <input
                      type="number"
                      min="0"
                      max="180"
                      step="1"
                      value={selectedAngleValue}
                      onChange={(e) => updateSelectedAngle(e.target.value)}
                      style={styles.input}
                    />
                  </label>

                  <div style={styles.angleInfo}>
                    L’angle est verrouillé. Les lignes restent attachées entre
                    elles autant que possible.
                  </div>

                  <button
                    type="button"
                    style={styles.dangerButton}
                    onClick={deleteSelectedAngle}
                  >
                    Supprimer l’angle sélectionné
                  </button>
                </div>
              ) : !selectedLine ? (
                <div style={styles.emptySelection}>
                  Clique sur une ligne pour modifier sa longueur, ou clique sur
                  un angle orange pour modifier sa valeur. Clique dans le blanc
                  pour enlever la sélection.
                </div>
              ) : (
                <>
                  <label style={styles.label}>
                    Longueur de la ligne en pouces
                    <input
                      type="number"
                      min="0.01"
                      step="0.25"
                      value={selectedLength}
                      onChange={(e) => updateSelectedLineLength(e.target.value)}
                      style={styles.input}
                    />
                  </label>

                  <button
                    type="button"
                    style={styles.dangerButton}
                    onClick={deleteSelectedLine}
                  >
                    Supprimer la ligne sélectionnée
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={styles.helpBox}>
              <strong>Mode Créer</strong>
              <p>
                Garde le clic gauche enfoncé pour tracer. Après la première
                ligne, les nouvelles lignes partent automatiquement du bout de
                la dernière ligne.
              </p>
              <p>
                Si tu traces proche de 0°, 90°, 180° ou 270°, la ligne devient
                parfaitement droite.
              </p>
            </div>
          )}

          <div style={styles.separator} />

          <button type="button" style={styles.saveButton} onClick={saveSketch}>
            Sauvegarder le dessin
          </button>

          <button type="button" style={styles.clearButton} onClick={clearSketch}>
            Effacer le dessin
          </button>
        </aside>
      </div>

      <section style={styles.tableSection}>
        <h2 style={styles.tableTitle}>Dessins sauvegardés</h2>

        {savedSketches.length === 0 ? (
          <div style={styles.emptyBox}>Aucun dessin sauvegardé pour le moment.</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nom</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Nombre de lignes</th>
                  <th style={styles.th}>Longueur totale</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {savedSketches.map((sketch) => (
                  <tr key={sketch.id}>
                    <td style={styles.td}>{sketch.name}</td>
                    <td style={styles.td}>{sketch.date}</td>
                    <td style={styles.td}>{sketch.lines.length}</td>
                    <td style={styles.td}>{sketch.totalLength}"</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.smallButton}
                        onClick={() => loadSketch(sketch)}
                      >
                        Recharger
                      </button>

                      <button
                        type="button"
                        style={styles.smallDangerButton}
                        onClick={() => deleteSavedSketch(sketch.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f2f4f8",
    padding: "24px",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    color: "#111827",
  },

  header: {
    maxWidth: "1250px",
    margin: "0 auto 18px auto",
  },

  title: {
    margin: 0,
    fontSize: "38px",
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },

  subtitle: {
    margin: "6px 0 0 0",
    color: "#4b5563",
    fontSize: "16px",
  },

  mainLayout: {
    maxWidth: "1250px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "1fr 320px",
    gap: "18px",
    alignItems: "start",
  },

  canvasCard: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "16px",
    boxShadow: "0 12px 35px rgba(15, 23, 42, 0.12)",
    border: "1px solid #e5e7eb",
  },

  canvasTopBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    gap: "14px",
  },

  canvasTitle: {
    fontSize: "18px",
    fontWeight: 900,
  },

  smallText: {
    display: "block",
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: 500,
    marginTop: "3px",
    lineHeight: 1.45,
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  resetButton: {
    border: "2px solid #111827",
    background: "#fff",
    color: "#111827",
    padding: "8px 12px",
    borderRadius: "999px",
    fontWeight: 900,
    fontSize: "13px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  modeBadge: {
    background: "#111827",
    color: "#fff",
    borderRadius: "999px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  svg: {
    width: "100%",
    maxWidth: `${CANVAS_SIZE}px`,
    aspectRatio: "1 / 1",
    display: "block",
    margin: "0 auto",
    background: "#fff",
    border: "3px solid #111827",
    borderRadius: "12px",
    userSelect: "none",
    touchAction: "none",
    overscrollBehavior: "contain",
  },

  sidePanel: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 12px 35px rgba(15, 23, 42, 0.12)",
    border: "1px solid #e5e7eb",
    position: "sticky",
    top: "16px",
    overflow: "hidden",
  },

  panelTitle: {
    margin: "0 0 16px 0",
    fontSize: "26px",
    fontWeight: 900,
  },

  modeButtons: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },

  modeButton: {
    border: "2px solid #111827",
    background: "#fff",
    color: "#111827",
    padding: "14px 10px",
    borderRadius: "14px",
    fontWeight: 900,
    fontSize: "15px",
    cursor: "pointer",
  },

  modeButtonActive: {
    background: "#111827",
    color: "#fff",
  },

  separator: {
    height: "1px",
    background: "#e5e7eb",
    margin: "16px 0",
  },

  angleButton: {
    width: "100%",
    border: "2px solid #f97316",
    background: "#fff",
    color: "#f97316",
    padding: "12px 14px",
    borderRadius: "12px",
    fontWeight: 900,
    fontSize: "15px",
    cursor: "pointer",
    marginBottom: "10px",
  },

  angleButtonActive: {
    background: "#f97316",
    color: "#fff",
  },

  angleHelp: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    borderRadius: "12px",
    padding: "10px",
    fontSize: "13px",
    fontWeight: 800,
    marginBottom: "14px",
  },

  angleInfo: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    borderRadius: "12px",
    padding: "10px",
    fontSize: "13px",
    fontWeight: 800,
    marginBottom: "14px",
    lineHeight: 1.35,
  },

  selectedBox: {
    marginTop: "4px",
  },

  label: {
    display: "block",
    fontWeight: 900,
    fontSize: "14px",
    marginBottom: "14px",
  },

  input: {
    width: "100%",
    marginTop: "6px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    fontSize: "16px",
    fontWeight: 800,
    outline: "none",
  },

  sectionTitle: {
    margin: "0 0 12px 0",
    fontSize: "18px",
    fontWeight: 900,
  },

  emptySelection: {
    background: "#f9fafb",
    border: "1px dashed #d1d5db",
    color: "#6b7280",
    borderRadius: "14px",
    padding: "16px",
    fontWeight: 800,
    fontSize: "14px",
    lineHeight: 1.4,
  },

  dangerButton: {
    width: "100%",
    border: "none",
    background: "#dc2626",
    color: "#fff",
    padding: "12px 14px",
    borderRadius: "12px",
    fontWeight: 900,
    fontSize: "14px",
    cursor: "pointer",
  },

  saveButton: {
    width: "100%",
    border: "none",
    background: "#16a34a",
    color: "#fff",
    padding: "13px 14px",
    borderRadius: "12px",
    fontWeight: 900,
    fontSize: "15px",
    cursor: "pointer",
    marginBottom: "10px",
  },

  clearButton: {
    width: "100%",
    border: "none",
    background: "#6b7280",
    color: "#fff",
    padding: "12px 14px",
    borderRadius: "12px",
    fontWeight: 900,
    fontSize: "14px",
    cursor: "pointer",
  },

  helpBox: {
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#14532d",
    borderRadius: "14px",
    padding: "14px",
    fontWeight: 800,
    lineHeight: 1.45,
  },

  tableSection: {
    maxWidth: "1250px",
    margin: "22px auto 0 auto",
    background: "#fff",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 12px 35px rgba(15, 23, 42, 0.1)",
    border: "1px solid #e5e7eb",
  },

  tableTitle: {
    margin: "0 0 14px 0",
    fontSize: "26px",
    fontWeight: 900,
  },

  emptyBox: {
    background: "#f9fafb",
    border: "1px dashed #d1d5db",
    borderRadius: "14px",
    padding: "22px",
    textAlign: "center",
    color: "#6b7280",
    fontWeight: 700,
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },

  th: {
    textAlign: "left",
    background: "#111827",
    color: "#fff",
    padding: "12px",
    border: "1px solid #111827",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "12px",
    border: "1px solid #e5e7eb",
    fontWeight: 700,
    verticalAlign: "middle",
  },

  smallButton: {
    border: "none",
    background: "#111827",
    color: "#fff",
    padding: "8px 10px",
    borderRadius: "9px",
    fontWeight: 800,
    cursor: "pointer",
    marginRight: "8px",
  },

  smallDangerButton: {
    border: "none",
    background: "#dc2626",
    color: "#fff",
    padding: "8px 10px",
    borderRadius: "9px",
    fontWeight: 800,
  },
};