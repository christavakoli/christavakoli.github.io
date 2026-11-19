"use strict";

(() => {
  const kind = document.getElementById("qr-kind");
  const security = document.getElementById("wifi-security");
  const preview = document.getElementById("qr-preview");
  const pngButton = document.getElementById("download-qr-png");
  const svgButton = document.getElementById("download-qr-svg");

  let generatedCanvas = null;
  let generatedSvg = "";

  function clearGenerated() {
    generatedCanvas = null;
    generatedSvg = "";
    pngButton.disabled = true;
    svgButton.disabled = true;

    preview.replaceChildren();

    const message = document.createElement("p");
    message.className = "hint";
    message.textContent = "Your QR code will appear here.";
    preview.append(message);
  }

  function showRelevantControls() {
    document.getElementById("url-controls").hidden = kind.value !== "url";
    document.getElementById("text-controls").hidden = kind.value !== "text";
    document.getElementById("wifi-controls").hidden = kind.value !== "wifi";

    clearGenerated();
  }

  kind.addEventListener("change", showRelevantControls);

  security.addEventListener("change", () => {
    document.getElementById("wifi-password-controls").hidden =
      security.value === "nopass";

    clearGenerated();
  });

  document.querySelectorAll(
    "#qr-url, #qr-text, #wifi-ssid, #wifi-password, " +
    "#wifi-hidden, #qr-foreground, #qr-background"
  ).forEach(control => {
    control.addEventListener("input", clearGenerated);
    control.addEventListener("change", clearGenerated);
  });

  function escapeWifi(value) {
    return value.replace(/([\\;,":])/g, "\\\$1");
  }

  function contentToEncode() {
    if (kind.value === "url") {
      const value = document.getElementById("qr-url").value.trim();

      if (!value) {
        throw new Error("Enter a website URL.");
      }

      let parsed;

      try {
        parsed = new URL(value);
      } catch (_) {
        throw new Error(
          "Enter a complete URL beginning with https:// or http://."
        );
      }

      if (!["https:", "http:"].includes(parsed.protocol)) {
        throw new Error("Only http:// and https:// website URLs are supported.");
      }

      return parsed.href;
    }

    if (kind.value === "text") {
      const value = document.getElementById("qr-text").value;

      if (!value.trim()) {
        throw new Error("Enter text to encode.");
      }

      return value;
    }

    const ssid = document.getElementById("wifi-ssid").value;
    const password = document.getElementById("wifi-password").value;
    const mode = security.value;
    const hidden = document.getElementById("wifi-hidden").checked;

    if (!ssid.trim()) {
      throw new Error("Enter a Wi-Fi network name.");
    }

    if (mode !== "nopass" && !password) {
      throw new Error("Enter the Wi-Fi password.");
    }

    return `WIFI:T:${mode};S:${escapeWifi(ssid)};` +
      `P:${mode === "nopass" ? "" : escapeWifi(password)};` +
      `H:${hidden ? "true" : "false"};;`;
  }

  function checkedColor(value) {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
      throw new Error("Choose valid foreground and background colors.");
    }

    return value;
  }

  function drawPng(matrix, count, foreground, background) {
    const quietZone = 4;
    const cellSize = Math.max(
      5,
      Math.floor(1024 / (count + quietZone * 2))
    );

    const size = (count + quietZone * 2) * cellSize;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is unavailable in this browser.");
    }

    context.fillStyle = background;
    context.fillRect(0, 0, size, size);

    context.fillStyle = foreground;

    for (let row = 0; row < count; row++) {
      for (let column = 0; column < count; column++) {
        if (matrix.isDark(row, column)) {
          context.fillRect(
            (column + quietZone) * cellSize,
            (row + quietZone) * cellSize,
            cellSize,
            cellSize
          );
        }
      }
    }

    return canvas;
  }

  function buildSvg(matrix, count, foreground, background) {
    const quietZone = 4;
    const side = count + quietZone * 2;
    const shapes = [];

    for (let row = 0; row < count; row++) {
      for (let column = 0; column < count; column++) {
        if (matrix.isDark(row, column)) {
          shapes.push(
            `<rect x="${column + quietZone}" ` +
            `y="${row + quietZone}" width="1" height="1"/>`
          );
        }
      }
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `viewBox="0 0 ${side} ${side}" ` +
      `width="${side * 10}" height="${side * 10}" ` +
      `shape-rendering="crispEdges">` +
      `<rect width="${side}" height="${side}" fill="${background}"/>` +
      `<g fill="${foreground}">${shapes.join("")}</g>` +
      `</svg>`
    );
  }

  document.getElementById("generate-qr")
    .addEventListener("click", () => {
      CVTools.showError("");
      clearGenerated();

      try {
        if (!window.QRCode) {
          throw new Error(
            "The QR library did not load. Check your connection and reload."
          );
        }

        const text = contentToEncode();
        const foreground = checkedColor(
          document.getElementById("qr-foreground").value
        );
        const background = checkedColor(
          document.getElementById("qr-background").value
        );

        /*
         * QRCode.js creates the encoded module matrix. Its own temporary
         * rendering is detached; both downloadable formats below are drawn
         * directly from the resulting matrix.
         */
        const temporaryElement = document.createElement("div");

        const qr = new QRCode(temporaryElement, {
          text,
          width: 256,
          height: 256,
          colorDark: foreground,
          colorLight: background,
          correctLevel: QRCode.CorrectLevel.M
        });

        const matrix = qr._oQRCode;

        if (
          !matrix ||
          typeof matrix.getModuleCount !== "function" ||
          typeof matrix.isDark !== "function"
        ) {
          throw new Error("Could not read the generated QR code.");
        }

        const count = matrix.getModuleCount();

        generatedCanvas = drawPng(
          matrix,
          count,
          foreground,
          background
        );

        generatedSvg = buildSvg(
          matrix,
          count,
          foreground,
          background
        );

        preview.replaceChildren(generatedCanvas);
        pngButton.disabled = false;
        svgButton.disabled = false;

        CVTools.toast("QR code generated.");
      } catch (error) {
        const message = /code length overflow/i.test(error.message || "")
          ? "That content is too long for a QR code. Shorten it and try again."
          : error.message || "Could not generate the QR code.";

        CVTools.showError(message);
      }
    });

  pngButton.addEventListener("click", async () => {
    CVTools.showError("");

    if (!generatedCanvas) {
      CVTools.showError("Generate a QR code before downloading it.");
      return;
    }

    try {
      const blob = await new Promise(resolve => {
        generatedCanvas.toBlob(resolve, "image/png");
      });

      if (!blob) {
        throw new Error("Could not create the PNG file.");
      }

      CVTools.download(blob, "qr-code.png");
    } catch (error) {
      CVTools.showError(error.message);
    }
  });

  svgButton.addEventListener("click", () => {
    CVTools.showError("");

    if (!generatedSvg) {
      CVTools.showError("Generate a QR code before downloading it.");
      return;
    }

    CVTools.download(
      new Blob([generatedSvg], {
        type: "image/svg+xml;charset=utf-8"
      }),
      "qr-code.svg"
    );
  });
})();
