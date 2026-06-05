import "./PropertiesPanel.css";
import { 
  Type, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Binary, 
  PenTool,
  Plus,
  Grid3X3,
  Grid,
  EyeOff
} from "lucide-react";

const PropertiesPanel = ({
  activeTool,
  strokeColor,
  setStrokeColor,
  bgColor,
  setBgColor,
  strokeWidth,
  setStrokeWidth,
  opacity,
  setOpacity,
  strokeType = "solid", 
  setStrokeType,
  roughness = 0.8,
  setRoughness,
  fontFamily = "sans",
  setFontFamily,
  textAlign = "left",
  setTextAlign,
  gridType = "none",  
  setGridType,
}) => {
  if (!activeTool || activeTool === "lock" || activeTool === "menu") {
    return null;
  }

  const strokeColors = [
    { name: "black", value: "#1f1f1f" },
    { name: "red", value: "#e03131" },
    { name: "green", value: "#2f9e44" },
    { name: "blue", value: "#1971c2" },
    { name: "orange", value: "#f08c00" },
    { name: "dark", value: "#212529" },
  ];

  const bgColors = [
    { name: "white", value: "#ffffff" },
    { name: "pink", value: "#f8d7da" },
    { name: "light-green", value: "#b7e4c7" },
    { name: "light-blue", value: "#b6d4fe" },
    { name: "yellow", value: "#f9e79f" },
    { name: "transparent", value: "transparent" },
  ];

  const widths = [
    { label: "─", value: "s" },
    { label: "━", value: "m" },
    { label: "▬", value: "l" },
  ];

  const strokeTypes = [
    { id: "solid", label: "", style: "solid" },
    { id: "dashed", label: "", style: "dashed" },
    { id: "dotted", label: "", style: "dotted" }
  ];

  const fontSizes = ["s", "m", "l", "xl"];
  const isCustomStroke = !strokeColors.some((c) => c.value === strokeColor);
  const isCustomBg = !bgColors.some((c) => c.value === bgColor) && bgColor !== "transparent";

  // Handles the persistent localStorage update loop matching your design preferences
  const handleGridChange = (value) => {
    if (setGridType) {
      setGridType(value);
      localStorage.setItem("whiteboard-grid-style", value);
    }
  };

  return (
    <div className="properties-panel">
      <div className="section">
        <h3>Stroke</h3>
        <div className="color-row">
          {strokeColors.map((color) => (
            <button
              key={color.value}
              className={`color-btn ${color.name} ${strokeColor === color.value ? "active" : ""}`}
              style={{ backgroundColor: color.value }}
              onClick={() => setStrokeColor(color.value)}
            ></button>
          ))}
          
          <label 
            className={`color-btn custom-picker-label ${isCustomStroke ? "active" : ""}`}
            style={{ backgroundColor: isCustomStroke ? strokeColor : "#eaeaea" }}
            title="Choose custom color"
          >
            <Plus size={14} color={isCustomStroke ? "#fff" : "#666"} />
            <input 
              type="color" 
              value={isCustomStroke ? strokeColor : "#000000"} 
              onChange={(e) => setStrokeColor(e.target.value)}
              className="hidden-color-input"
            />
          </label>
        </div>
      </div>

      {activeTool === "text" ? (
        <>
          <div className="section">
            <h3>Font family</h3>
            <div className="option-row text-options">
              {[
                { id: "handdrawn", icon: <PenTool size={14} strokeWidth={2.5} /> },
                { id: "sans", icon: <Type size={15} strokeWidth={2.5} /> },
                { id: "mono", icon: <Binary size={14} strokeWidth={2.5} /> },
              ].map((font) => (
                <button
                  key={font.id}
                  className={`option-btn ${fontFamily === font.id ? "selected" : ""}`}
                  onClick={() => setFontFamily && setFontFamily(font.id)}
                >
                  {font.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <h3>Font size</h3>
            <div className="option-row text-options">
              {fontSizes.map((size) => (
                <button
                  key={size}
                  className={`option-btn ${strokeWidth === size ? "selected" : ""}`}
                  onClick={() => setStrokeWidth(size)}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <h3>Text align</h3>
            <div className="option-row text-options">
              {[
                { id: "left", icon: <AlignLeft size={15} strokeWidth={2.5} /> },
                { id: "center", icon: <AlignCenter size={15} strokeWidth={2.5} /> },
                { id: "right", icon: <AlignRight size={15} strokeWidth={2.5} /> },
              ].map((align) => (
                <button
                  key={align.id}
                  className={`option-btn ${textAlign === align.id ? "selected" : ""}`}
                  onClick={() => setTextAlign && setTextAlign(align.id)}
                >
                  {align.icon}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="section">
            <h3>Background</h3>
            <div className="color-row">
              {bgColors.map((color) => (
                <button
                  key={color.value}
                  className={`color-btn ${color.name} ${bgColor === color.value ? "active" : ""}`}
                  style={{ backgroundColor: color.value === "transparent" ? "transparent" : color.value }}
                  onClick={() => setBgColor(color.value)}
                ></button>
              ))}

              <label 
                className={`color-btn custom-picker-label ${isCustomBg ? "active" : ""}`}
                style={{ backgroundColor: isCustomBg ? bgColor : "#eaeaea" }}
                title="Choose custom background color"
              >
                <Plus size={14} color={isCustomBg ? "#fff" : "#666"} />
                <input 
                  type="color" 
                  value={isCustomBg ? bgColor : "#ffffff"} 
                  onChange={(e) => setBgColor(e.target.value)}
                  className="hidden-color-input"
                />
              </label>
            </div>
          </div>

          <div className="section">
            <h3>Stroke width</h3>
            <div className="option-row">
              {widths.map((w) => (
                <button
                  key={w.value}
                  className={`option-btn ${strokeWidth === w.value ? "selected" : ""}`}
                  onClick={() => setStrokeWidth(w.value)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <h3>Stroke style</h3>
            <div className="option-row stroke-type-row">
              {strokeTypes.map((t) => (
                <button
                  key={t.id}
                  className={`option-btn stroke-style-btn ${strokeType === t.id ? "selected" : ""}`}
                  onClick={() => setStrokeType && setStrokeType(t.id)}
                >
                  <span className={`line-preview ${t.style}`}></span>
                  <span className="btn-label-text">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="section-header-value">
              <h3>Sloppiness</h3>
              <span className="value-badge">{roughness === 0 ? "Perfect" : roughness <= 0.8 ? "Architect" : "Sketchy"}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={roughness}
              onChange={(e) => setRoughness && setRoughness(Number(e.target.value))}
              className="property-slider"
            />
            <div className="range-labels">
              <span>Clean</span>
              <span>Hand-Drawn</span>
            </div>
          </div>
        </>
      )}

      <div className="section">
        <h3>Opacity</h3>
        <input
          type="range"
          min="0"
          max="100"
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="property-slider"
        />
        <div className="range-labels">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="section grid-customizer-section">
        <h3>Canvas Grid Style</h3>
        <div className="option-row text-options">
          {[
            { id: "none", label: "None", icon: <EyeOff size={14} /> },
            { id: "dots", label: "Dots", icon: <Grid size={14} strokeWidth={2.8} /> },
            { id: "engineering", label: "Graph", icon: <Grid3X3 size={14} /> },
          ].map((grid) => (
            <button
              key={grid.id}
              className={`option-btn ${gridType === grid.id ? "selected" : ""}`}
              onClick={() => handleGridChange(grid.id)}
              title={`${grid.label} view`}
              style={{ display: "flex", gap: "5px", alignItems: "center", padding: "6px 10px" }}
            >
              {grid.icon}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};

export default PropertiesPanel;