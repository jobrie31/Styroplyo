export const CANVAS_SIZE = 700;
export const DEFAULT_SCALE = 30;
export const SNAP_DEGREES = 5;
export const DEFAULT_GAUGE = 24;
export const SHAPE_VISIBLE_RATIO = 0.55;
export const SHARED_POINT_TOLERANCE = 10;

export const DEFAULT_VIEWBOX = {
  x: 0,
  y: 0,
  size: CANVAS_SIZE,
};

export function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function gaugeToStroke(gauge) {
  const max = 10;
  const min = 1.5;
  const ratio = (28 - gauge) / (28 - 12);
  return min + ratio * (max - min);
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function normalizeAngle(angle) {
  let a = angle % 360;
  if (a < 0) a += 360;
  return a;
}

export function signedAngleDifference(a1, a2) {
  return ((a2 - a1 + 540) % 360) - 180;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getLineLengthInches(line, scale) {
  return (
    Math.round(
      (distance(line.x1, line.y1, line.x2, line.y2) / scale) * 100
    ) / 100
  );
}

export function getLineAngleDeg(line) {
  const angle = radToDeg(Math.atan2(line.y1 - line.y2, line.x2 - line.x1));
  return Math.round(normalizeAngle(angle) * 10) / 10;
}

export function getLineCenter(line) {
  return {
    x: (line.x1 + line.x2) / 2,
    y: (line.y1 + line.y2) / 2,
  };
}

export function getAnglePairKey(lineId1, lineId2) {
  return [lineId1, lineId2].sort().join("__");
}

export function findSharedPoint(l1, l2) {
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

export function forceLinesToStayConnected(lines) {
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

export function getVectorAwayFromVertex(line, vertex) {
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

export function getAngleBetweenLinesAtVertex(l1, l2) {
  const vertex = findSharedPoint(l1, l2);

  if (!vertex) return null;

  const v1 = getVectorAwayFromVertex(l1, vertex);
  const v2 = getVectorAwayFromVertex(l2, vertex);

  const dot = clamp(v1.x * v2.x + v1.y * v2.y, -1, 1);
  const angle = radToDeg(Math.acos(dot));

  return Math.round(angle * 10) / 10;
}

export function getAngleLabelDefaultPosition(l1, l2, viewBox) {
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

export function snapAngle(angle) {
  const normalized = normalizeAngle(angle);
  const snapTargets = [0, 90, 180, 270, 360];

  for (const target of snapTargets) {
    if (Math.abs(normalized - target) <= SNAP_DEGREES) {
      return target === 360 ? 0 : target;
    }
  }

  return normalized;
}

export function getSnappedPoint(x1, y1, x2, y2) {
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

export function rebuildConnectedLines(lines, changedIndex, newChangedLine) {
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

export function getDrawingBounds(lines) {
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

export function getAutoViewBox(lines) {
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

export function makeGridLines(viewBox) {
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

export function boxesOverlap(a, b) {
  const margin = 6;

  return !(
    a.x + a.width + margin < b.x ||
    b.x + b.width + margin < a.x ||
    a.y + a.height + margin < b.y ||
    b.y + b.height + margin < a.y
  );
}

export function lineIntersectsBox(line, box) {
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

export function getDimensionFontSize(viewBox) {
  const wantedScreenPx = 24;
  const worldSize = (wantedScreenPx * viewBox.size) / CANVAS_SIZE;

  return Math.max(9, Math.min(worldSize, 32));
}

export function getAngleFontSize(viewBox) {
  const wantedScreenPx = 26;
  const worldSize = (wantedScreenPx * viewBox.size) / CANVAS_SIZE;

  return Math.max(10, Math.min(worldSize, 34));
}

export function clampLabelInsideView(label, viewBox) {
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

export function makeDimensionLabels(lines, scale, viewBox, dimensionPositions) {
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

export function getTouchDistance(touches) {
  if (touches.length < 2) return 0;

  const t1 = touches[0];
  const t2 = touches[1];

  return distance(t1.clientX, t1.clientY, t2.clientX, t2.clientY);
}

export function getTouchCenter(touches) {
  if (touches.length < 2) return null;

  const t1 = touches[0];
  const t2 = touches[1];

  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

export function rotateLineAroundVertex(line, vertex, targetAngle) {
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