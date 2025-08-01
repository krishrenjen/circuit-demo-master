import { setSelected } from "node_modules/blockly/core/common";
import type { ShortcutDefinition } from "../hooks/useCircuitShortcuts";
import type { CircuitElement, Wire } from "../types/circuit";

type ShortcutMetadata = Omit<ShortcutDefinition, "handler">;

type ShortcutArgs = {
  elements: CircuitElement[];
  wires: Wire[];
  selectedElement: CircuitElement | null;
  setElements: React.Dispatch<React.SetStateAction<CircuitElement[]>>;
  setWires: React.Dispatch<React.SetStateAction<Wire[]>>;
  setSelectedElement: React.Dispatch<
    React.SetStateAction<CircuitElement | null>
  >;
  setCreatingWireStartNode: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingWire: React.Dispatch<React.SetStateAction<any>>;
  pushToHistory: () => void;
  stopSimulation: () => void;
  resetState: () => void;
  getNodeParent: (nodeId: string) => CircuitElement | null | undefined;
  undo: () => void;
  toggleSimulation: () => void;
  updateWiresDirect?: () => void; // Add wire update function
};

/**
 * Returns metadata about available shortcuts for display purposes (without handlers).
 */
export function getShortcutMetadata(): ShortcutMetadata[] {
  return [
    {
      name: "Cancel wire creation",
      description: "Cancel wire creation and editing",
      keys: ["escape"],
    },
    {
      name: "Reset",
      description: "Reset the entire canvas",
      keys: ["ctrl", "l"],
    },
    {
      name: "Undo",
      description: "Undo last action",
      keys: ["ctrl", "z"],
    },
    {
      name: "Delete selected",
      description: "Delete selected element and connected wires",
      keys: ["delete"],
    },
    {
      name: "Clear wires",
      description: "Delete all wires",
      keys: ["shift", "w"],
    },
    {
      name: "Start/stop simulation",
      description: "Start or stop the circuit simulation",
      keys: ["ctrl", "space"],
    },
    {
      name: "Rotate element",
      description: "Rotate selected element by 30 degrees clockwise",
      keys: ["shift", "r"],
    },
  ];
}

/**
 * Returns full shortcut definitions with handler functions attached.
 */
export function getCircuitShortcuts(args: ShortcutArgs): ShortcutDefinition[] {
  const {
    elements,
    wires,
    selectedElement,
    setElements,
    setWires,
    setSelectedElement,
    setCreatingWireStartNode,
    setEditingWire,
    pushToHistory,
    stopSimulation,
    resetState,
    getNodeParent,
    undo,
    toggleSimulation,
  } = args;

  return getShortcutMetadata().map((meta) => {
    switch (meta.keys.join("+")) {
      case "escape":
        return {
          ...meta,
          handler: () => {
            setCreatingWireStartNode(null);
            setEditingWire(null);
            setSelectedElement(null);
          },
        };
      case "ctrl+l":
        return {
          ...meta,
          handler: () => {
            setSelectedElement(null);
            resetState();
          }
        };
      case "ctrl+z":
        return {
          ...meta,
          handler: () => undo(),
        };
      case "delete":
        return {
          ...meta,
          handler: () => {
            if (!selectedElement) return;
            pushToHistory();
            if (selectedElement.type === "wire") {
              setWires((prev) =>
                prev.filter((w) => w.id !== selectedElement.id)
              );
            } else {
              setElements((prev) =>
                prev.filter((el) => el.id !== selectedElement.id)
              );
              setWires((prev) =>
                prev.filter(
                  (w) =>
                    getNodeParent(w.fromNodeId)?.id !== selectedElement.id &&
                    getNodeParent(w.toNodeId)?.id !== selectedElement.id
                )
              );
            }
            stopSimulation();
            setSelectedElement(null);
            setCreatingWireStartNode(null);
            setEditingWire(null);
          },
        };
      case "shift+w":
        return {
          ...meta,
          handler: () => {
            pushToHistory();
            setWires([]);
            stopSimulation();
          },
        };
      case "ctrl+space":
        return {
          ...meta,
          handler: () => {
            toggleSimulation();
          },
        };
      case "shift+r":
        return {
          ...meta,
          handler: () => {
            if (!selectedElement || selectedElement.type === "wire") return;
            pushToHistory();
            setElements((prev) =>
              prev.map((el) =>
                el.id === selectedElement.id
                  ? {
                    ...el,
                    rotation: ((el.rotation || 0) + 30) % 360,
                  }
                  : el
              )
            );
            // Update wires immediately after rotation to prevent lag
            if (args.updateWiresDirect) {
              // Use setTimeout to ensure the element state update is processed first
              setTimeout(() => {
                args.updateWiresDirect!();
              }, 0);
            }
            stopSimulation();
          },
        };
      default:
        return {
          ...meta,
          handler: () => { },
        };
    }
  });
}
