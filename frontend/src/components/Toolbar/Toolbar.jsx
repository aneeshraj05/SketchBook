import "./Toolbar.css";
import { tools } from "../../data/tools";

const Toolbar = ({
  activeTool,
  setActiveTool,
}) => {
  return (
    <div className="toolbar">
      {tools.map((tool) => {
        const Icon = tool.icon;

        return (
          <button
            key={tool.id}
            className={
              activeTool === tool.id
                ? "tool-btn active"
                : "tool-btn"
            }
            onClick={() =>
              setActiveTool(tool.id)
            }
          >
            <Icon size={18} strokeWidth={1.2} />
          </button>
        );
      })}
    </div>
  );
};

export default Toolbar;