"use strict";

(() => {
  const editor = document.getElementById("text-input");

  function updateCounts() {
    const text = editor.value;

    const words = text.trim()
      ? (
          text.match(
            /[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu
          ) || []
        ).length
      : 0;

    document.getElementById("word-count").textContent = words;
    document.getElementById("character-count").textContent =
      Array.from(text).length;

    const seconds = Math.ceil(words * 60 / 200);

    document.getElementById("reading-time").textContent =
      seconds < 60
        ? `${seconds} sec`
        : `${Math.ceil(seconds / 60)} min`;
  }

  editor.addEventListener("input", updateCounts);
  updateCounts();

  document.getElementById("clean-text").addEventListener("click", () => {
    CVTools.showError("");

    if (!editor.value) {
      CVTools.showError("Enter text to clean.");
      return;
    }

    const mode = document.getElementById("cleanup-mode").value;
    const normalized = editor.value.replace(/\r\n?/g, "\n");

    if (mode === "single-line") {
      editor.value = normalized.replace(/\s+/g, " ").trim();
    } else if (mode === "collapse-spaces") {
      editor.value = normalized
        .replace(/[^\S\n]+/g, " ")
        .split("\n")
        .map(line => line.trim())
        .join("\n");
    } else {
      editor.value = normalized
        .split("\n")
        .map(line => line.trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    updateCounts();
  });

  document.getElementById("change-case").addEventListener("click", () => {
    CVTools.showError("");

    if (!editor.value) {
      CVTools.showError("Enter text before changing its case.");
      return;
    }

    const mode = document.getElementById("case-mode").value;

    if (mode === "upper") {
      editor.value = editor.value.toUpperCase();
    } else if (mode === "lower") {
      editor.value = editor.value.toLowerCase();
    } else if (mode === "title") {
      editor.value = editor.value
        .toLowerCase()
        .replace(
          /\p{L}[\p{L}\p{M}]*/gu,
          word => word.charAt(0).toUpperCase() + word.slice(1)
        );
    } else {
      editor.value = editor.value
        .toLowerCase()
        .replace(
          /(^|[.!?]\s+)(\p{L})/gu,
          (_, prefix, letter) => prefix + letter.toUpperCase()
        );
    }

    updateCounts();
  });

  document.getElementById("copy-text")
    .addEventListener("click", async () => {
      CVTools.showError("");

      try {
        if (!editor.value) {
          throw new Error("Enter text to copy.");
        }

        await CVTools.copy(editor.value);
      } catch (error) {
        CVTools.showError(error.message);
      }
    });

  function splitLines(text) {
    return text.replace(/\r\n?/g, "\n").split("\n");
  }

  function addDisplayedLine(container, text, className) {
    const line = document.createElement("span");

    line.className = className
      ? `diff-line ${className}`
      : "diff-line";

    // A nonbreaking space keeps an intentionally blank line visible.
    line.textContent = text === "" ? "\u00A0" : text;
    container.append(line);
  }

  document.getElementById("compare-text").addEventListener("click", () => {
    CVTools.showError("");

    const original = document.getElementById("original-text").value;
    const revised = document.getElementById("revised-text").value;

    const originalResult = document.getElementById("original-result");
    const revisedResult = document.getElementById("revised-result");

    originalResult.replaceChildren();
    revisedResult.replaceChildren();

    if (!original && !revised) {
      CVTools.showError("Enter text in at least one comparison box.");
      return;
    }

    const left = splitLines(original);
    const right = splitLines(revised);

    if (left.length > 750 || right.length > 750) {
      CVTools.showError(
        "Comparison is limited to 750 lines per side. Shorten the text and try again."
      );
      return;
    }

    // Longest-common-subsequence lengths for line-by-line comparison.
    const lengths = Array.from(
      { length: left.length + 1 },
      () => new Uint16Array(right.length + 1)
    );

    for (let i = left.length - 1; i >= 0; i--) {
      for (let j = right.length - 1; j >= 0; j--) {
        lengths[i][j] = left[i] === right[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
      }
    }

    let i = 0;
    let j = 0;

    while (i < left.length || j < right.length) {
      if (
        i < left.length &&
        j < right.length &&
        left[i] === right[j]
      ) {
        addDisplayedLine(originalResult, left[i], "");
        addDisplayedLine(revisedResult, right[j], "");
        i++;
        j++;
      } else if (
        j < right.length &&
        (
          i === left.length ||
          lengths[i][j + 1] >= lengths[i + 1][j]
        )
      ) {
        addDisplayedLine(originalResult, "", "");
        addDisplayedLine(revisedResult, right[j], "diff-added");
        j++;
      } else {
        addDisplayedLine(originalResult, left[i], "diff-removed");
        addDisplayedLine(revisedResult, "", "");
        i++;
      }
    }

    CVTools.toast("Comparison complete.");
  });
})();
