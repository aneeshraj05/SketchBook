import Toolbar from "./components/Toolbar/Toolbar";
import Canvas from "./components/Canvas/Canvas";
import {useState} from "react";

function App() {
  const [activeTool, setActiveTool] = useState("select");
  const [elements, setElements] = useState([]);
  return (
    <>
    <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
      />

      <Canvas
        activeTool={activeTool}
        elements={elements}
        setElements={setElements}
      />
    </>
  );
}

export default App;