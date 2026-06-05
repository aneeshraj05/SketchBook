import React, { useState } from "react";
import Toolbar from "./components/Toolbar/Toolbar";
import Canvas from "./components/Canvas/Canvas";
import PropertiesPanel from "./components/PropertiesPanel";
import MainMenu from "./components/MainMenu/ManiMenu";

function App() {
  const [activeTool, setActiveTool] = useState("select");
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // 🔒 CANVAS WORKSPACE UNIFORM LOCK STATE
  const [isLocked, setIsLocked] = useState(false);

  // Shared States for Element Styling Attributes
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("transparent"); 
  const [strokeWidth, setStrokeWidth] = useState("m"); 
  const [opacity, setOpacity] = useState(100);

  // ADVANCED STYLING STATES: Core Line Styles & Sloppiness Engine
  const [strokeType, setStrokeType] = useState("solid"); 
  const [roughness, setRoughness] = useState(0.8);       

  // Text-specific configuration states for the menu
  const [fontFamily, setFontFamily] = useState("sans");
  const [textAlign, setTextAlign] = useState("left");

  // 🌐 BACKGROUND STORAGE ENGINE (Loads from localStorage instantly)
  const [canvasBg, setCanvasBg] = useState(() => {
    return localStorage.getItem("whiteboard-bg") || "#ffffff";
  });

  // 🏁 GRID STORAGE ENGINE (Loads from localStorage instantly)
  const [gridType, setGridType] = useState(() => {
    return localStorage.getItem("whiteboard-grid-style") || "none";
  });

  // 🔎 FIXED ZOOM RESET TRIGGER (Numerical increment trigger system)
  const [zoomResetTrigger, setZoomResetTrigger] = useState(0);

  const handleResetZoomState = () => {
    setZoomResetTrigger(prev => prev + 1); // Increments counter to announce updates
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      
      <div className="no-print">
        
        <MainMenu 
          elements={elements} 
          setElements={setElements} 
          setBgColor={setCanvasBg} 
          activeBgColor={canvasBg}
          onResetZoom={handleResetZoomState} // <-- Injected reset state action handler
        />

        <div style={{ position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)", zIndex: 10100 }}>
          <Toolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            isLocked={isLocked}      
            setIsLocked={setIsLocked} 
          />
        </div>

        <div style={{ position: "fixed", left: "12px", top: "72px", zIndex: 10100 }}>
          <PropertiesPanel
            activeTool={activeTool}
            strokeColor={strokeColor}
            setStrokeColor={setStrokeColor}
            bgColor={bgColor}
            setBgColor={setBgColor}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            opacity={opacity}
            setOpacity={setOpacity}
            strokeType={strokeType}
            setStrokeType={setStrokeType}
            roughness={roughness}
            setRoughness={setRoughness}
            fontFamily={fontFamily}      
            setFontFamily={setFontFamily} 
            textAlign={textAlign}         
            setTextAlign={setTextAlign}   
            gridType={gridType}
            setGridType={setGridType}
          />
        </div>

      </div>

      <Canvas
        isLocked={isLocked} 
        activeTool={activeTool}
        elements={elements}
        setElements={setElements}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        strokeColor={strokeColor}
        bgColor={bgColor}              
        canvasBgColor={canvasBg}        
        strokeWidth={strokeWidth}
        opacity={opacity}
        strokeType={strokeType}
        roughness={roughness}
        fontFamily={fontFamily} 
        textAlign={textAlign}   
        gridType={gridType}
        zoomResetTrigger={zoomResetTrigger} // 👈 Injected numerical tracking value
      />
    </div>
  );
}

export default App;