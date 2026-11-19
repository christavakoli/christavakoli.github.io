"use strict";

(() => {
  const pdfEntries = [];
  const imageEntries = [];

  const pdfList = document.getElementById("pdf-list");
  const imageList = document.getElementById("pdf-image-list");

  function assertLibrary() {
    if (!window.PDFLib) {
      throw new Error(
        "The PDF library did not load. Check your connection and reload this page."
      );
    }
  }

  function moveEntry(entries, index, direction, list, isPdf) {
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;

    [entries[index], entries[target]] = [entries[target], entries[index]];
    renderEntries(entries, list, isPdf);
  }

  function renderEntries(entries, list, isPdf) {
    list.replaceChildren();

    entries.forEach((entry, index) => {
      const item = document.createElement("li");
      const row = document.createElement("div");
      row.className = "item-row";

      const name = document.createElement("strong");
      name.textContent = `${index + 1}. ${entry.file.name}` +
        (isPdf ? ` — ${entry.pageCount} page(s)` : "");

      const controls = document.createElement("div");
      controls.className = "actions";

      const actions = [
        ["↑", index === 0, () => moveEntry(entries, index, -1, list, isPdf)],
        ["↓", index === entries.length - 1,
          () => moveEntry(entries, index, 1, list, isPdf)],
        ["Remove", false, () => {
          entries.splice(index, 1);
          renderEntries(entries, list, isPdf);
        }]
      ];

      actions.forEach(([text, disabled, handler]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn";
        button.textContent = text;
        button.disabled = disabled;
        button.setAttribute("aria-label", `${text} ${entry.file.name}`);
        button.addEventListener("click", handler);
        controls.append(button);
      });

      row.append(name, controls);
      item.append(row);

      if (isPdf) {
        const label = document.createElement("label");
        label.textContent = `Page order for ${entry.file.name}`;

        const field = document.createElement("input");
        field.type = "text";
        field.placeholder = `All ${entry.pageCount} pages`;
        field.value = entry.selection;

        field.addEventListener("input", () => {
          entry.selection = field.value;
        });

        label.append(field);
        item.append(label);
      }

      list.append(item);
    });
  }

  function selectedPages(text, pageCount) {
    if (!text.trim()) {
      return Array.from({ length: pageCount }, (_, index) => index);
    }

    const result = [];

    for (const part of text.split(",")) {
      const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);

      if (!match) {
        throw new Error(
          `Invalid page entry "${part.trim()}". Use page numbers or ranges like 2-5.`
        );
      }

      const first = Number(match[1]);
      const last = match[2] === undefined ? first : Number(match[2]);

      if (first < 1 || last < 1 || first > pageCount || last > pageCount) {
        throw new Error(`Page numbers must be between 1 and ${pageCount}.`);
      }

      const step = first <= last ? 1 : -1;

      for (let page = first; ; page += step) {
        result.push(page - 1);

        if (page === last) break;

        if (result.length > 10000) {
          throw new Error("Too many pages were selected.");
        }
      }
    }

    return result;
  }

  CVTools.attachDropzone(
    document.getElementById("pdf-drop"),
    document.getElementById("pdf-files"),
    async files => {
      CVTools.showError("");

      try {
        assertLibrary();

        for (const file of files) {
          if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
            throw new Error(
              `${file.name} is not a PDF. Previously accepted files remain selected.`
            );
          }

          let documentToInspect;

          try {
            documentToInspect = await PDFLib.PDFDocument.load(
              await file.arrayBuffer()
            );
          } catch (_) {
            throw new Error(
              `Could not open ${file.name}. It may be damaged or password-protected.`
            );
          }

          const pageCount = documentToInspect.getPageCount();

          if (pageCount < 1) {
            throw new Error(`${file.name} contains no pages.`);
          }

          pdfEntries.push({ file, pageCount, selection: "" });
          renderEntries(pdfEntries, pdfList, true);
        }
      } catch (error) {
        CVTools.showError(error.message);
      }
    }
  );

  CVTools.attachDropzone(
    document.getElementById("pdf-image-drop"),
    document.getElementById("pdf-images"),
    files => {
      CVTools.showError("");

      for (const file of files) {
        if (
          !/\.(png|jpe?g|webp)$/i.test(file.name) &&
          !["image/png", "image/jpeg", "image/webp"].includes(file.type)
        ) {
          CVTools.showError(
            `${file.name} is not a PNG, JPG or WebP image.`
          );
          break;
        }

        imageEntries.push({ file });
      }

      renderEntries(imageEntries, imageList, false);
    }
  );

  document.getElementById("clear-pdfs").addEventListener("click", () => {
    pdfEntries.length = 0;
    renderEntries(pdfEntries, pdfList, true);
    CVTools.showError("");
  });

  document.getElementById("clear-pdf-images").addEventListener("click", () => {
    imageEntries.length = 0;
    renderEntries(imageEntries, imageList, false);
    CVTools.showError("");
  });

  document.getElementById("build-pdf").addEventListener("click", async event => {
    CVTools.showError("");
    const button = event.currentTarget;
    button.disabled = true;

    try {
      assertLibrary();

      if (!pdfEntries.length) {
        throw new Error("Choose at least one PDF.");
      }

      const output = await PDFLib.PDFDocument.create();

      for (const entry of pdfEntries) {
        const source = await PDFLib.PDFDocument.load(
          await entry.file.arrayBuffer()
        );

        const pages = selectedPages(
          entry.selection,
          source.getPageCount()
        );

        for (const index of pages) {
          const [copiedPage] = await output.copyPages(source, [index]);
          output.addPage(copiedPage);
        }
      }

      const bytes = await output.save();

      CVTools.download(
        new Blob([bytes], { type: "application/pdf" }),
        "organized.pdf"
      );
      CVTools.toast("PDF ready.");
    } catch (error) {
      CVTools.showError(
        error.message || "Could not create the PDF. Check your selected files."
      );
    } finally {
      button.disabled = false;
    }
  });

  async function embedForPdf(pdf, file) {
    const bytes = await file.arrayBuffer();

    if (file.type === "image/png" || /\.png$/i.test(file.name)) {
      return pdf.embedPng(bytes);
    }

    if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) {
      return pdf.embedJpg(bytes);
    }

    // pdf-lib embeds PNG and JPG. Decode WebP through Canvas first.
    const url = URL.createObjectURL(file);

    try {
      const image = new Image();
      image.src = url;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      if (!canvas.width || !canvas.height) {
        throw new Error("The image has invalid dimensions.");
      }

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");

      context.drawImage(image, 0, 0);

      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!blob) {
        throw new Error("The image could not be converted.");
      }

      return pdf.embedPng(await blob.arrayBuffer());
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  document.getElementById("build-image-pdf")
    .addEventListener("click", async event => {
      CVTools.showError("");
      const button = event.currentTarget;
      button.disabled = true;

      try {
        assertLibrary();

        if (!imageEntries.length) {
          throw new Error("Choose at least one image.");
        }

        const pdf = await PDFLib.PDFDocument.create();

        for (const entry of imageEntries) {
          let embedded;

          try {
            embedded = await embedForPdf(pdf, entry.file);
          } catch (_) {
            throw new Error(
              `Could not read ${entry.file.name}. The image may be damaged or too large.`
            );
          }

          const page = pdf.addPage([embedded.width, embedded.height]);
          page.drawImage(embedded, {
            x: 0,
            y: 0,
            width: embedded.width,
            height: embedded.height
          });
        }

        CVTools.download(
          new Blob([await pdf.save()], { type: "application/pdf" }),
          "images.pdf"
        );
        CVTools.toast("PDF ready.");
      } catch (error) {
        CVTools.showError(error.message || "Could not create the PDF.");
      } finally {
        button.disabled = false;
      }
    });
})();
