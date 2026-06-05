import React, { useState, useEffect, useRef } from "react";
import { Menu, Save, Image, Trash2 } from "lucide-react";
import "./MainMenu.css";
import git from './github.png';
import lin from './linkedin.png';

const MainMenu = ({ elements, setElements }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // 1. Core Background State Management loaded from storage
  const [localBgColor, setLocalBgColor] = useState(() => {
    return localStorage.getItem("whiteboard-bg") || "#ffffff";
  }); 
  
  const menuRef = useRef(null);

  // 2. Continuous Sync Loop: Keeps looking for canvas until it finds it to inject background
  useEffect(() => {
    const applySavedBackground = () => {
      const canvasElement = document.querySelector("canvas");
      if (canvasElement) {
        canvasElement.style.backgroundColor = localBgColor;
      }
    };

    applySavedBackground();
    
    // Fallback mutation observer if canvas delays rendering inside app viewport wrappers
    const observer = new MutationObserver(applySavedBackground);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, [localBgColor]);

  // Close menu when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle escape key exits
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  // Action: Clear entire canvas memory node instantly & reset background storage data
  const handleResetCanvas = () => {
    setElements([]);
    localStorage.setItem("whiteboard-data", JSON.stringify([]));
    
    setLocalBgColor("#ffffff");
    localStorage.setItem("whiteboard-bg", "#ffffff");
    
    setIsOpen(false);
  };

  const backgroundPresets = [
    { value: "#ffffff", title: "White" },
    { value: "#f8f9fa", title: "Light Gray" },
    { value: "#f1f3f5", title: "Gray Tint" },
    { value: "#fff9db", title: "Soft Yellow" },
    { value: "#e7f5ff", title: "Soft Blue" },
    { value: "#ebfbee", title: "Soft Green" }
  ];

  const handleBgChange = (colorValue) => {
    setLocalBgColor(colorValue);
    localStorage.setItem("whiteboard-bg", colorValue); 
    
    const canvasElement = document.querySelector("canvas"); 
    if (canvasElement) {
      canvasElement.style.backgroundColor = colorValue;
    }
  };

  return (
    <div className="main-menu-container" ref={menuRef}>
      <button className="menu-toggle-btn" onClick={() => setIsOpen(!isOpen)} title="Main menu">
        <Menu size={20} strokeWidth={2.5} />
      </button>

      {isOpen && (
        <div className="menu-dropdown-panel">
          
          <button className="menu-item-row" onClick={() => window.print()}>
            <div className="menu-item-content">
              <span className="menu-item-icon"><Image size={16} /></span>
              <span>Export as Pdf</span>
            </div>
            <span className="menu-item-shortcut">Ctrl+P</span>
          </button>

          <button className="menu-item-row" onClick={handleResetCanvas}>
            <div className="menu-item-content">
              <span className="menu-item-icon"><Trash2 size={16} /></span>
              <span>Reset the canvas</span>
            </div>
          </button>

          <div className="menu-section-divider" />

          {/* Social Links */}
          <a className="menu-item-row" href="https://github.com/aneeshraj05" target="_blank" rel="noopener noreferrer">
            <div className="menu-item-content">
              <img src={git} alt="GitHub" style={{ width: "16px", height: "16px" }} />
              <span>GitHub</span>
            </div>
          </a>

          <a className="menu-item-row" href="https://linkedin.com/in/aneeshraj05" target="_blank" rel="noopener noreferrer">
            <div className="menu-item-content">
              <img src={lin} alt="LinkedIn" style={{ width: "16px", height: "16px" }} />
              <span>LinkedIn</span>
            </div>
          </a>

          <div className="menu-section-divider" />

          {/* Canvas Background Grid Panel */}
          <div className="canvas-bg-picker-section">
            <div className="bg-picker-title">Canvas background</div>
            <div className="bg-picker-grid">
              {backgroundPresets.map((swatch) => (
                <button
                  key={swatch.value}
                  className={`bg-color-swatch-btn ${localBgColor === swatch.value ? "is-active" : ""}`}
                  style={{ backgroundColor: swatch.value }}
                  onClick={() => handleBgChange(swatch.value)}
                  title={swatch.title}
                />
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default MainMenu;