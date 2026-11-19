"use strict";

(() => {
  const selectedFiles = [];
  const list = document.getElementById("image-list");
  const format = document.getElementById("output-format");
  const resizeMode = document.getElementById("resize-mode");
  const quality = document.getElementById("image-quality");

  function renderFiles() {
    list.replaceChildren();

    selectedFiles.forEach((file, index) => {
      const item = document.createElement("li");
      const row = document.createElement("div");
      row.className = "item-row";

      const name = document.createElement("strong");
      name.textContent = file.name;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        selectedFiles.splice(index, 1);
        renderFiles();
      });

      row.append(name, remove);
      item.append(row);
      list.append(item);
    });
  }

  CVTools.attachDropzone(
    document.getElementById("image-drop"),
    document.getElementById("image-files"),
    files => {
      CVTools.showError("");

      for (const file of files) {
        const recognizedType = [
          "image/png", "image/jpeg", "image/webp", "image/avif"
        ].includes(file.type);

        const recognizedName = /\.(png|jpe?g|webp|avif)$/i.test(file.name);

        if (!recognizedType && !recognizedName) {
          CVTools.showError(
            `${file.name} is not a PNG, JPG, WebP or AVIF image.`
          );
          break;
        }

        selectedFiles.push(file);
      }

      renderFiles();
    }
  );

  document.getElementById("clear-images").addEventListener("click", () => {
    selectedFiles.length = 0;
    renderFiles();
    CVTools.showError("");
  });

  resizeMode.addEventListener("change", () => {
    document.getElementById("pixel-controls").hidden =
      resizeMode.value !== "pixels";

    document.getElementById("percent-controls").hidden =
      resizeMode.value !== "percent";
  });

  quality.addEventListener("input", () => {
    document.getElementById("quality-display").value = quality.value;
  });

  function wholeNumber(value, name, maximum) {
    const number = Number(value);

    if (!Number.isInteger(number) || number < 1 || number > maximum) {
      throw new Error(
        `${name} must be a whole number between 1 and ${maximum}.`
      );
    }

    return number;
  }

  async function convertOne(file) {
    const url = URL.createObjectURL(file);

    try {
      const image = new Image();
      image.src = url;

      try {
        await image.decode();
      } catch (_) {
        throw new Error(
          `${file.name} could not be opened by this browser.`
        );
      }

      let width = image.naturalWidth;
      let height = image.naturalHeight;

      if (resizeMode.value === "pixels") {
        width = wholeNumber(
          document.getElementById("target-width").value,
          "Width",
          16384
        );

        height = wholeNumber(
          document.getElementById("target-height").value,
          "Height",
          16384
        );
      } else if (resizeMode.value === "percent") {
        const percent = wholeNumber(
          document.getElementById("target-percent").value,
          "Percentage",
          1000
        );

        width = Math.max(1, Math.round(width * percent / 100));
        height = Math.max(1, Math.round(height * percent / 100));
      }

      if (
        !width || !height ||
        width > 16384 ||
        height > 16384 ||
        width * height > 50000000
      ) {
        throw new Error(
          `${file.name} exceeds the output limit of 16,384 pixels per side or 50 million pixels total.`
        );
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas is unavailable in this browser.");
      }

      if (format.value === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }

      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise(resolve => {
        canvas.toBlob(
          resolve,
          format.value,
          Number(quality.value) / 100
        );
      });

      if (!blob || blob.type !== format.value) {
        const label = format.options[format.selectedIndex].text;

        throw new Error(
          `Your browser cannot export ${label}. Choose another format or browser.`
        );
      }

      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  document.getElementById("convert-images")
    .addEventListener("click", async event => {
      CVTools.showError("");
      const button = event.currentTarget;
      button.disabled = true;

      try {
        if (!selectedFiles.length) {
          throw new Error("Choose at least one image.");
        }

        if (selectedFiles.length > 1 && !window.JSZip) {
          throw new Error(
            "The ZIP library did not load. Check your connection and reload."
          );
        }

        const extensions = {
          "image/png": "png",
          "image/jpeg": "jpg",
          "image/webp": "webp",
          "image/avif": "avif"
        };

        const extension = extensions[format.value];
        const counts = new Map();
        const results = [];

        for (const file of selectedFiles) {
          const base = file.name
            .replace(/\.[^.]+$/, "")
            .replace(/[\\/:*?"<>|]/g, "_") || "image";

          const nextCount = (counts.get(base) || 0) + 1;
          counts.set(base, nextCount);

          const filename =
            `${base}${nextCount > 1 ? "-" + nextCount : ""}.${extension}`;

          results.push([filename, await convertOne(file)]);
        }

        if (results.length === 1) {
          CVTools.download(results[0][1], results[0][0]);
        } else {
          const zip = new JSZip();

          for (const [name, blob] of results) {
            zip.file(name, blob);
          }

          const archive = await zip.generateAsync({ type: "blob" });
          CVTools.download(archive, "converted-images.zip");
        }

        CVTools.toast(`${results.length} image(s) converted.`);
      } catch (error) {
        CVTools.showError(error.message || "Image conversion failed.");
      } finally {
        button.disabled = false;
      }
    });
})();
