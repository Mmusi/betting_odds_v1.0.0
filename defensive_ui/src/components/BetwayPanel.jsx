import React, { useEffect, useState } from "react";

export default function BetwayPanel() {
  const [iframeError, setIframeError] = useState(false);
  const [showEmbed, setShowEmbed] = useState(true);
  const [popupWindow, setPopupWindow] = useState(null);

  // Detect embed failure
  useEffect(() => {
    const timer = setTimeout(() => {
      const iframe = document.getElementById("betway-frame");
      if (iframe && !iframe.contentWindow) {
        setIframeError(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // ----------------------------
  // OPEN POPUP WITH CUSTOM UI
  // ----------------------------
  const openPopup = () => {
    const width = 1200;
    const height = 850;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      "",
      "BetwayBridge",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );

    if (!popup) {
      alert("Popup blocked! Please allow popups for this site.");
      return;
    }

    // ----------------------------
    // WRITE COMPLETE CUSTOM HTML UI
    // ----------------------------
    popup.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Betway Live Odds</title>
        <style>
          body, html { margin: 0; height: 100%; overflow: hidden; font-family: sans-serif; }
          iframe { width: 100%; height: 100%; border: none; }
          #overlay {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            background: rgba(255,255,255,0.98);
            border: 1px solid #ccc;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            z-index: 9999;
          }
          input {
            width: 80px;
            font-size: 14px;
            text-align: center;
            margin: 4px 0;
            border-radius: 5px;
            border: 1px solid #ccc;
            padding: 4px;
          }
          button {
            margin-top: 8px;
            padding: 7px 12px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          }
          button:hover { background: #1e40af; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
          h3 { margin-bottom: 6px; font-size: 14px; text-align: center; }
        </style>
      </head>
      <body>

        <iframe src="https://www.betway.co.bw/sport/soccer/live"></iframe>

        <div id="overlay">
          <h3>📋 Enter Match Odds</h3>
          <div class="grid">
            <input id="H" placeholder="Home (1)" />
            <input id="D" placeholder="Draw (X)" />
            <input id="A" placeholder="Away (2)" />
            <input id="HD" placeholder="1X (H/D)" />
            <input id="AD" placeholder="X2 (A/D)" />
            <input id="HA" placeholder="12 (H/A)" />
          </div>

          <div style="display:flex;justify-content:space-between;margin-top:8px;">
            <button onclick="pasteAll()">📋 Paste</button>
            <button onclick="sendAll()">🚀 Send</button>
          </div>

          <script>
            // Paste 6 odds in order from clipboard
            async function pasteAll() {
              try {
                const text = await navigator.clipboard.readText();
                const parts = text.split(/\\s+/);

                const order = ["H","D","A","HD","AD","HA"];
                for (let i=0;i<order.length;i++) {
                  document.getElementById(order[i]).value = parts[i] || "";
                }
              } catch (e) {
                alert("Clipboard access denied. Paste manually.");
              }
            }

            // Send full structured batch to React parent
            function sendAll() {
              const fields = ["H","D","A","HD","AD","HA"];
              const map = {
                H: "home",
                D: "draw",
                A: "away",
                HD: "hd",
                AD: "ad",
                HA: "ha"
              };

              const odds = {};
              fields.forEach(f => {
                const val = document.getElementById(f).value.trim();
                if (val) odds[map[f]] = val;
              });

              window.opener.postMessage({
                type: "betwayOddsBatch",
                odds
              }, "*");
            }
          </script>

        </div>
      </body>
      </html>
    `);

    popup.focus();
    setPopupWindow(popup);
  };

  // close popup when parent unmounts
  useEffect(() => {
    return () => {
      if (popupWindow && !popupWindow.closed) popupWindow.close();
    };
  }, [popupWindow]);

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-300">
      <div className="p-2 bg-gray-100 border-b flex justify-between items-center">
        <h2 className="font-semibold text-sm text-gray-700">⚽ Betway Live Odds</h2>

        <div className="space-x-2">
          <button
            onClick={() => setShowEmbed(true)}
            className={`px-2 py-1 text-xs rounded ${
              showEmbed ? "bg-indigo-600 text-white" : "bg-gray-200"
            }`}
          >
            Embed
          </button>

          <button
            onClick={() => {
              setShowEmbed(false);
              openPopup();
            }}
            className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
          >
            Popup
          </button>
        </div>
      </div>

      {showEmbed && !iframeError ? (
        <iframe
          id="betway-frame"
          src="https://www.betway.co.bw/sport/soccer/live"
          title="Betway Live Odds"
          className="w-full flex-1"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          onError={() => setIframeError(true)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 text-center text-sm text-gray-600">
          <p className="mb-2">⚠️ Betway cannot be embedded directly.</p>
          <button
            onClick={openPopup}
            className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Open Betway Popup
          </button>
        </div>
      )}
    </div>
  );
}
