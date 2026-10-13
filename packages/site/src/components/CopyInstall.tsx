/** The install command, with a button that copies it. */
import { Fragment, useState, type ReactElement } from "react";

const COMMANDS = [{ label: "npm", command: "npm install ireko" }] as const;

/**
 * This function copies the text. It uses the clipboard API, and an older method when the browser has no clipboard
 * API. It gives false when neither method copies.
 */
const copy = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // The page has no permission: the next method can still copy.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
};

/** The install line. */
export default function CopyInstall(): ReactElement {
  const [state, setState] = useState<{ readonly command: string; readonly ok: boolean } | undefined>(undefined);
  return (
    <div className="ik-install">
      {COMMANDS.map(({ label, command }) => (
        <div className="ik-install-row" key={command}>
          <code>
            {command.split(" ").map((word, index) => (
              <Fragment key={word}>
                {index > 0 ? " " : null}
                <span className="ik-install-word">{word}</span>
              </Fragment>
            ))}
          </code>
          <button
            type="button"
            className="ik-button"
            aria-label={`Copy the ${label} command`}
            onClick={() => {
              void copy(command).then((ok) => {
                setState({ command, ok });
                if (ok) setTimeout(() => setState(undefined), 1500);
              });
            }}
          >
            {state?.command === command ? (state.ok ? "Copied" : "Not copied") : "Copy"}
          </button>
          <span className="ik-sr" aria-live="polite">
            {state?.command === command && state.ok ? "The command is on the clipboard." : ""}
          </span>
          {state?.command === command && !state.ok ? (
            <p className="ik-install-error" role="status">
              The browser did not let the page copy. Select the command and copy it.
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
