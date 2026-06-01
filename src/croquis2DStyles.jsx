import { CANVAS_SIZE } from "./croquis2DUtils";

export const styles = {
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

    modeButtonsThree: {
    display: "grid",
    gridTemplateColumns: "1fr",
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