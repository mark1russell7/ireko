import { useState } from "react";
import { ParentChildLayoutsDemo } from "./components/ParentChildFlow";
import { TestbedMatrix } from "./components/ui/playground/Testbed";

function App() {
  const [tab, setTab] = useState<"Playground" | "Testbed">("Playground");

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <div style={{ position: "absolute", top: 100, left: 8, zIndex: 2000 }}>
        <button
          onClick={() => setTab("Playground")}
          style={{
            padding: "6px 10px",
            marginRight: 6,
            borderRadius: 6,
            border: "1px solid #d0d7de",
            background: tab === "Playground" ? "#111827" : "#fff",
            color: tab === "Playground" ? "#fff" : "#111827",
            fontSize: 12,
          }}
        >
          Playground
        </button>
        <button
          onClick={() => setTab("Testbed")}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #d0d7de",
            background: tab === "Testbed" ? "#111827" : "#fff",
            color: tab === "Testbed" ? "#fff" : "#111827",
            fontSize: 12,
          }}
        >
          Testbed
        </button>
      </div>

      {tab === "Playground" ? <ParentChildLayoutsDemo /> : <TestbedMatrix />}
    </div>
  );
}

export default App;
