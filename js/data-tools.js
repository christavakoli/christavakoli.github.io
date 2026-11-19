"use strict";

(() => {
  const input = document.getElementById("data-input");
  const output = document.getElementById("data-output");
  const direction = document.getElementById("conversion-direction");
  const previewContainer = document.getElementById("table-preview");
  const previewStatus = document.getElementById("preview-status");

  let outputExtension = "";

  function clearResult() {
    output.value = "";
    outputExtension = "";
    previewContainer.replaceChildren();
    previewStatus.textContent = "Convert data to see a preview.";
  }

  function parseCsv(source) {
    const text = source.replace(/^\uFEFF/, "");

    if (!text.trim()) {
      throw new Error("Enter CSV data before converting.");
    }

    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;
    let afterClosingQuote = false;

    for (let index = 0; index < text.length; index++) {
      const character = text[index];

      if (insideQuotes) {
        if (character === '"' && text[index + 1] === '"') {
          field += '"';
          index++;
        } else if (character === '"') {
          insideQuotes = false;
          afterClosingQuote = true;
        } else {
          field += character;
        }

        continue;
      }

      if (character === '"' && field === "" && !afterClosingQuote) {
        insideQuotes = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
        afterClosingQuote = false;
      } else if (character === "\r" || character === "\n") {
        row.push(field);
        rows.push(row);

        row = [];
        field = "";
        afterClosingQuote = false;

        if (character === "\r" && text[index + 1] === "\n") {
          index++;
        }
      } else {
        if (afterClosingQuote || character === '"') {
          throw new Error(
            `Invalid CSV quoting near character ${index + 1}.`
          );
        }

        field += character;
      }
    }

    if (insideQuotes) {
      throw new Error("A quoted CSV field was not closed.");
    }

    // A trailing newline finishes the previous row; it is not an extra row.
    if (row.length > 0 || field !== "" || afterClosingQuote ||
        !/[\r\n]$/.test(text)) {
      row.push(field);
      rows.push(row);
    }

    const headers = rows.shift();

    if (!headers || headers.length === 0 ||
        headers.some(header => !header.trim())) {
      throw new Error("The CSV header row cannot contain empty column names.");
    }

    if (new Set(headers).size !== headers.length) {
      throw new Error("CSV column names must be unique.");
    }

    const objects = rows.map((cells, index) => {
      if (cells.length !== headers.length) {
        throw new Error(
          `CSV row ${index + 2} has ${cells.length} field(s); ` +
          `${headers.length} were expected.`
        );
      }

      return Object.fromEntries(
        headers.map((header, column) => [header, cells[column]])
      );
    });

    return { headers, objects };
  }

  function csvCell(value) {
    let text;

    if (value === null || value === undefined) {
      text = "";
    } else if (typeof value === "object") {
      text = JSON.stringify(value);
    } else {
      text = String(value);
    }

    return /[",\r\n]/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  }

  function rowsFromJson(value) {
    if (!Array.isArray(value) || value.length === 0 ||
        value.some(row =>
          row === null ||
          typeof row !== "object" ||
          Array.isArray(row)
        )) {
      throw new Error(
        "JSON-to-CSV input must be a nonempty array of objects."
      );
    }

    const headers = [
      ...new Set(value.flatMap(row => Object.keys(row)))
    ];

    if (!headers.length) {
      throw new Error("The JSON objects contain no columns.");
    }

    return { headers, objects: value };
  }

  function showPreview(headers, objects) {
    previewContainer.replaceChildren();

    const table = document.createElement("table");
    const headerRow = table.createTHead().insertRow();

    for (const name of headers) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = name;
      headerRow.append(cell);
    }

    const body = table.createTBody();

    for (const row of objects.slice(0, 50)) {
      const tableRow = body.insertRow();

      for (const name of headers) {
        const cell = tableRow.insertCell();
        const value = row[name];

        cell.textContent =
          value === null || value === undefined
            ? ""
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value);
      }
    }

    previewContainer.append(table);
    previewStatus.textContent =
      `Showing ${Math.min(objects.length, 50)} of ` +
      `${objects.length} data row(s).`;
  }

  input.addEventListener("input", clearResult);

  direction.addEventListener("change", () => {
    clearResult();

    input.placeholder = direction.value === "json-to-csv"
      ? '[{"name":"Ada","age":36}]'
      : "name,age\nAda,36";
  });

  document.getElementById("convert-data").addEventListener("click", () => {
    CVTools.showError("");
    clearResult();

    try {
      if (!input.value.trim()) {
        throw new Error("Enter data before converting.");
      }

      if (direction.value === "json-to-csv") {
        const { headers, objects } = rowsFromJson(
          JSON.parse(input.value)
        );

        output.value = [
          headers.map(csvCell).join(","),
          ...objects.map(row =>
            headers.map(header => csvCell(row[header])).join(",")
          )
        ].join("\r\n");

        outputExtension = "csv";
        showPreview(headers, objects);
      } else {
        const { headers, objects } = parseCsv(input.value);

        output.value = JSON.stringify(objects, null, 2);
        outputExtension = "json";
        showPreview(headers, objects);
      }

      CVTools.toast("Conversion complete.");
    } catch (error) {
      CVTools.showError(
        error instanceof SyntaxError
          ? `Invalid JSON: ${error.message}`
          : error.message
      );
    }
  });

  document.getElementById("format-json").addEventListener("click", () => {
    CVTools.showError("");

    try {
      if (!input.value.trim()) {
        throw new Error("Enter JSON to format.");
      }

      input.value = JSON.stringify(JSON.parse(input.value), null, 2);
      clearResult();
      CVTools.toast("JSON is valid and formatted.");
    } catch (error) {
      CVTools.showError(
        error instanceof SyntaxError
          ? `Invalid JSON: ${error.message}`
          : error.message
      );
    }
  });

  document.getElementById("copy-output")
    .addEventListener("click", async () => {
      CVTools.showError("");

      try {
        if (!outputExtension) {
          throw new Error("Convert data before copying.");
        }

        await CVTools.copy(output.value);
      } catch (error) {
        CVTools.showError(error.message);
      }
    });

  document.getElementById("download-output")
    .addEventListener("click", () => {
      CVTools.showError("");

      if (!outputExtension) {
        CVTools.showError("Convert data before downloading.");
        return;
      }

      const isCsv = outputExtension === "csv";
      const content = isCsv ? "\uFEFF" + output.value : output.value;
      const mime = isCsv
        ? "text/csv;charset=utf-8"
        : "application/json;charset=utf-8";

      CVTools.download(
        new Blob([content], { type: mime }),
        `converted.${outputExtension}`
      );
    });
})();
