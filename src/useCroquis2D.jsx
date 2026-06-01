import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_GAUGE,
  DEFAULT_SCALE,
  DEFAULT_VIEWBOX,
  clamp,
  degToRad,
  distance,
  findSharedPoint,
  forceLinesToStayConnected,
  getAngleBetweenLinesAtVertex,
  getAngleLabelDefaultPosition,
  getAnglePairKey,
  getAutoViewBox,
  getLineAngleDeg,
  getLineLengthInches,
  getSnappedPoint,
  getTouchCenter,
  getTouchDistance,
  getVectorAwayFromVertex,
  makeDimensionLabels,
  makeGridLines,
  makeId,
  normalizeAngle,
  radToDeg,
  rebuildConnectedLines,
  rotateLineAroundVertex,
  signedAngleDifference,
} from "./croquis2DUtils";

export function useCroquis2D() {
  const svgRef = useRef(null);

  const [mode, setMode] = useState("ajoutLigne");

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

  const [draggingEndpoint, setDraggingEndpoint] = useState(null);

  const scale = DEFAULT_SCALE;
  const MAX_LINE_LENGTH_INCHES = 30;
  const MAX_LINE_LENGTH_PX = MAX_LINE_LENGTH_INCHES * scale;

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

  const baseViewBox = mode === "ajoutLigne" ? DEFAULT_VIEWBOX : autoViewBox;
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

  function clampPointToMaxLineLength(fixedPoint, movingPoint) {
    const lineLength = distance(
      fixedPoint.x,
      fixedPoint.y,
      movingPoint.x,
      movingPoint.y
    );

    if (lineLength <= MAX_LINE_LENGTH_PX) {
      return movingPoint;
    }

    const ratio = MAX_LINE_LENGTH_PX / lineLength;

    return {
      x: fixedPoint.x + (movingPoint.x - fixedPoint.x) * ratio,
      y: fixedPoint.y + (movingPoint.y - fixedPoint.y) * ratio,
    };
  }

  function parseLengthValue(value) {
    const cleanValue = String(value || "")
      .replace(",", ".")
      .replace('"', "")
      .trim();

    const number = Number(cleanValue);

    if (!number || Number.isNaN(number) || number <= 0) {
      return null;
    }

    return Math.min(number, MAX_LINE_LENGTH_INCHES);
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

    if (mode !== "ajoutLigne") return;
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

  function snapEndpointToRightAngle(fixedPoint, movingPoint) {
    const SNAP_MOVE_DEGREES = 8;

    const rawLength = distance(
      fixedPoint.x,
      fixedPoint.y,
      movingPoint.x,
      movingPoint.y
    );

    if (rawLength <= 0) return movingPoint;

    const rawAngle = radToDeg(
      Math.atan2(fixedPoint.y - movingPoint.y, movingPoint.x - fixedPoint.x)
    );

    const normalizedAngle = normalizeAngle(rawAngle);

    const snapTargets = [0, 90, 180, 270, 360];

    for (const target of snapTargets) {
      const diff = Math.abs(normalizedAngle - target);

      if (diff <= SNAP_MOVE_DEGREES) {
        const snappedAngle = target === 360 ? 0 : target;
        const radians = degToRad(snappedAngle);

        return {
          x: fixedPoint.x + Math.cos(radians) * rawLength,
          y: fixedPoint.y - Math.sin(radians) * rawLength,
        };
      }
    }

    return movingPoint;
  }

  function moveConnectedEndpoint(lineId, endpoint, point) {
    setLines((prev) => {
      const index = prev.findIndex((line) => line.id === lineId);
      if (index === -1) return prev;

      const next = prev.map((line) => ({ ...line }));

      const line = next[index];

      if (endpoint === "start") {
        const fixedPoint = {
          x: line.x2,
          y: line.y2,
        };

        const snappedPoint = snapEndpointToRightAngle(fixedPoint, point);
        const limitedPoint = clampPointToMaxLineLength(
          fixedPoint,
          snappedPoint
        );

        next[index].x1 = limitedPoint.x;
        next[index].y1 = limitedPoint.y;

        if (index > 0) {
          next[index - 1].x2 = limitedPoint.x;
          next[index - 1].y2 = limitedPoint.y;
        }
      }

      if (endpoint === "end") {
        const fixedPoint = {
          x: line.x1,
          y: line.y1,
        };

        const snappedPoint = snapEndpointToRightAngle(fixedPoint, point);
        const limitedPoint = clampPointToMaxLineLength(
          fixedPoint,
          snappedPoint
        );

        next[index].x2 = limitedPoint.x;
        next[index].y2 = limitedPoint.y;

        if (index < next.length - 1) {
          next[index + 1].x1 = limitedPoint.x;
          next[index + 1].y1 = limitedPoint.y;
        }
      }

      return next;
    });
  }

  function updateLineLengthById(lineId, newLength) {
    const limitedLength = parseLengthValue(newLength);

    if (!limitedLength) return;

    setLines((prev) => {
      const connectedPrev = forceLinesToStayConnected(prev);

      const index = connectedPrev.findIndex((line) => line.id === lineId);

      if (index === -1) return connectedPrev;

      const line = connectedPrev[index];
      const angle = getLineAngleDeg(line);
      const radians = degToRad(angle);

      const newLine = {
        ...line,
        x2: line.x1 + Math.cos(radians) * limitedLength * scale,
        y2: line.y1 - Math.sin(radians) * limitedLength * scale,
      };

      const rebuilt = rebuildConnectedLines(connectedPrev, index, newLine);

      return applyAngleConstraintsForLine(rebuilt, lineId);
    });
  }

  function askLineLength(lineId) {
    const line = lines.find((item) => item.id === lineId);
    if (!line) return;

    const currentLength = getLineLengthInches(line, scale);

    const answer = window.prompt(
      `Nouvelle longueur en pouces, maximum ${MAX_LINE_LENGTH_INCHES}"`,
      String(currentLength)
    );

    if (answer === null) return;

    updateLineLengthById(lineId, answer);
    setSelectedLineId(lineId);
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

    if (draggingEndpoint) {
      const point = getMousePoint(e);

      moveConnectedEndpoint(
        draggingEndpoint.lineId,
        draggingEndpoint.endpoint,
        point
      );

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

    if (mode !== "ajoutLigne") return;
    if (!isDrawing || !currentLine) return;

    const point = getMousePoint(e);

    const snappedPoint = getSnappedPoint(
      currentLine.x1,
      currentLine.y1,
      point.x,
      point.y
    );

    const limitedPoint = clampPointToMaxLineLength(
      {
        x: currentLine.x1,
        y: currentLine.y1,
      },
      snappedPoint
    );

    setCurrentLine((prev) => ({
      ...prev,
      x2: limitedPoint.x,
      y2: limitedPoint.y,
    }));
  }

  function finishDrawingLine() {
    if (mode !== "ajoutLigne") return;
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

    if (draggingEndpoint) {
      setDraggingEndpoint(null);
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

    if (draggingEndpoint) {
      setDraggingEndpoint(null);
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

  function handleEndpointMouseDown(e, lineId, endpoint) {
    if (mode !== "bougerLignes") return;

    e.stopPropagation();
    e.preventDefault();

    setDraggingEndpoint({
      lineId,
      endpoint,
    });

    setSelectedLineId(lineId);
    setSelectedAngleId(null);
    setAngleMode(false);
    setSelectedAngleLineIds([]);
  }

  function handleLineClick(e, lineId) {
    e.stopPropagation();

    if (mode === "bougerLignes") {
      askLineLength(lineId);
      return;
    }

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

  function handleDimensionClick(e, lineId) {
    e.stopPropagation();

    if (mode === "bougerLignes") {
      askLineLength(lineId);
      return;
    }

    if (mode === "dimensions") {
      setSelectedLineId(lineId);
      setSelectedAngleId(null);
    }
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

    updateLineLengthById(selectedLine.id, newLength);
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
    setDraggingEndpoint(null);
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
              getAnglePairKey(
                angle.lineIds?.[0] || "",
                angle.lineIds?.[1] || ""
              ),
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
    setDraggingEndpoint(null);
    setMode("dimensions");
  }

  function deleteSavedSketch(id) {
    setSavedSketches((prev) => prev.filter((sketch) => sketch.id !== id));
  }

  function activateAddLineMode() {
    setMode("ajoutLigne");
    setCurrentLine(null);
    setIsDrawing(false);
    setSelectedLineId(null);
    setSelectedAngleId(null);
    setHoveredLineId(null);
    setDraggingDimensionId(null);
    setDraggingAngleId(null);
    setDraggingEndpoint(null);
    setAngleMode(false);
    setSelectedAngleLineIds([]);
  }

  function activateMoveLinesMode() {
    setMode("bougerLignes");
    setCurrentLine(null);
    setIsDrawing(false);
    setSelectedAngleId(null);
    setDraggingDimensionId(null);
    setDraggingAngleId(null);
    setDraggingEndpoint(null);
    setAngleMode(false);
    setSelectedAngleLineIds([]);
  }

  function activateDimensionsMode() {
    setMode("dimensions");
    setCurrentLine(null);
    setIsDrawing(false);
    setDraggingEndpoint(null);
  }

  return {
    svgRef,

    mode,
    lines,
    currentLine,
    selectedLineId,
    hoveredLineId,
    draggingDimensionId,
    draggingAngleId,
    draggingEndpoint,
    angleMode,
    selectedAngleLineIds,
    selectedAngleId,
    angleLabels,
    savedSketches,
    isPanning,

    selectedLine,
    selectedAngle,
    selectedAngleValue,
    selectedLength,
    activeViewBox,
    gridLines,
    dimensionLabels,
    scale,

    setHoveredLineId,

    handleContextMenu,
    clearSelectionIfBackground,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleLineClick,
    handleDimensionClick,
    handleEndpointMouseDown,
    handleDimensionMouseDown,
    handleAngleMouseDown,

    startAngleMode,
    cancelAngleMode,
    updateSelectedLineLength,
    updateSelectedAngle,
    deleteSelectedAngle,
    deleteSelectedLine,
    clearSketch,
    resetView,
    saveSketch,
    loadSketch,
    deleteSavedSketch,
    activateAddLineMode,
    activateMoveLinesMode,
    activateDimensionsMode,
  };
}