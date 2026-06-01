import { styles } from "./croquis2DStyles";
import { useCroquis2D } from "./useCroquis2D";

import {
  DEFAULT_GAUGE,
  gaugeToStroke,
  getAngleBetweenLinesAtVertex,
  getAngleFontSize,
  getAngleLabelDefaultPosition,
  getDimensionFontSize,
  getLineCenter,
  getLineLengthInches,
  findSharedPoint,
} from "./croquis2DUtils";

export default function Croquis2D() {
  const croquis = useCroquis2D();

  const {
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
  } = croquis;

  function getModeInstruction() {
    if (mode === "ajoutLigne") {
      return lines.length === 0
        ? "Clique gauche tenu + glisser pour créer la première ligne."
        : "La prochaine ligne part automatiquement du bout de la dernière ligne.";
    }

    if (mode === "bougerLignes") {
      return "Clique-glisse sur les points bleus aux bouts des lignes pour changer leur longueur ou leur angle.";
    }

    if (angleMode) {
      return "Clique sur deux lignes qui se touchent pour ajouter un angle.";
    }

    return "Clique sur une ligne ou un angle pour le modifier. Les lignes restent attachées entre elles.";
  }

  function getModeLabel() {
    if (mode === "ajoutLigne") return "Ajouter une ligne";
    if (mode === "bougerLignes") return "Bouger les lignes";
    return "Changer les dimensions";
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
              <span style={styles.smallText}>{getModeInstruction()}</span>
            </div>

            <div style={styles.topActions}>
              <button type="button" style={styles.resetButton} onClick={resetView}>
                Recentrer
              </button>

              <div style={styles.modeBadge}>Mode : {getModeLabel()}</div>
            </div>
          </div>

          <svg
            ref={svgRef}
            viewBox={`${activeViewBox.x} ${activeViewBox.y} ${activeViewBox.size} ${activeViewBox.size}`}
            style={{
              ...styles.svg,
              cursor:
                mode === "ajoutLigne"
                  ? "crosshair"
                  : isPanning || draggingEndpoint
                  ? "grabbing"
                  : draggingDimensionId || draggingAngleId
                  ? "grabbing"
                  : mode === "bougerLignes"
                  ? "default"
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

              const showMoveHandles =
                mode === "bougerLignes" ||
                mode === "dimensions" ||
                isSelected ||
                isHovered;

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
                      cursor:
                        mode === "dimensions"
                          ? "pointer"
                          : mode === "bougerLignes"
                          ? "default"
                          : "crosshair",
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

                  {showMoveHandles && (
                    <>
                      <circle
                        cx={line.x1}
                        cy={line.y1}
                        r={13}
                        fill="#0f62fe"
                        stroke="#ffffff"
                        strokeWidth={3}
                        opacity={mode === "bougerLignes" ? 1 : 0.85}
                        onMouseDown={(e) =>
                          handleEndpointMouseDown(e, line.id, "start")
                        }
                        style={{
                          cursor:
                            mode === "bougerLignes" ? "grab" : "default",
                        }}
                      />

                      <circle
                        cx={line.x2}
                        cy={line.y2}
                        r={13}
                        fill="#0f62fe"
                        stroke="#ffffff"
                        strokeWidth={3}
                        opacity={mode === "bougerLignes" ? 1 : 0.85}
                        onMouseDown={(e) =>
                          handleEndpointMouseDown(e, line.id, "end")
                        }
                        style={{
                          cursor:
                            mode === "bougerLignes" ? "grab" : "default",
                        }}
                      />
                    </>
                  )}
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
              const defaultPos = getAngleLabelDefaultPosition(
                l1,
                l2,
                activeViewBox
              );

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

          <div style={styles.modeButtonsThree}>
            <button
              type="button"
              onClick={activateAddLineMode}
              style={{
                ...styles.modeButton,
                ...(mode === "ajoutLigne" ? styles.modeButtonActive : {}),
              }}
            >
              Ajouter une ligne
            </button>

            <button
              type="button"
              onClick={activateMoveLinesMode}
              style={{
                ...styles.modeButton,
                ...(mode === "bougerLignes" ? styles.modeButtonActive : {}),
              }}
            >
              Bouger les lignes
            </button>

            <button
              type="button"
              onClick={activateDimensionsMode}
              style={{
                ...styles.modeButton,
                ...(mode === "dimensions" ? styles.modeButtonActive : {}),
              }}
            >
              Changer les dimensions
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
          ) : mode === "bougerLignes" ? (
            <div style={styles.helpBox}>
              <strong>Mode Bouger les lignes</strong>
              <p>
                Clique sur un point bleu au bout d’une ligne, garde le clic
                enfoncé, puis déplace-le.
              </p>
              <p>
                Si deux lignes se touchent au même bout, elles restent attachées
                pendant le déplacement.
              </p>
            </div>
          ) : (
            <div style={styles.helpBox}>
              <strong>Mode Ajouter une ligne</strong>
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