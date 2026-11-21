"use strict";

(() => {
  function byId(id) {
    return document.getElementById(id);
  }

  function value(id) {
    return byId(id).value.trim();
  }

  function setText(id, text) {
    byId(id).textContent = text;
  }

  function setOptional(id, text) {
    const element = byId(id);
    element.textContent = text;
    element.hidden = !text;
  }

  function money(cents, currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency
    }).format(cents / 100);
  }

  function nonnegativeNumber(raw, label, maximum) {
    if (raw === "" || raw === null || raw === undefined) {
      throw new Error(`Enter ${label}.`);
    }

    const number = Number(raw);

    if (!Number.isFinite(number) ||
        number < 0 ||
        number > maximum) {
      throw new Error(
        `${label} must be between 0 and ${maximum}.`
      );
    }

    return number;
  }

  function toCents(raw, label) {
    const number = nonnegativeNumber(raw, label, 1000000);

    if (!/^\d+(?:\.\d{1,2})?$/.test(String(raw).trim())) {
      throw new Error(`${label} can have at most two decimal places.`);
    }

    return Math.round(number * 100);
  }

  function percentage(raw, label) {
    const number = nonnegativeNumber(raw, label, 100);

    if (!/^\d+(?:\.\d{1,2})?$/.test(String(raw).trim())) {
      throw new Error(`${label} can have at most two decimal places.`);
    }

    return number;
  }

  function quantity(raw) {
    const number = nonnegativeNumber(raw, "Quantity", 100000);

    if (number <= 0) {
      throw new Error("Item quantities must be greater than zero.");
    }

    if (!/^\d+(?:\.\d{1,3})?$/.test(String(raw).trim())) {
      throw new Error("Quantities can have at most three decimal places.");
    }

    return number;
  }

  function todayLocal() {
    const date = new Date();
    const local = new Date(date.getTime() -
      date.getTimezoneOffset() * 60000);

    return local.toISOString().slice(0, 10);
  }

  function nowLocal() {
    const date = new Date();
    const local = new Date(date.getTime() -
      date.getTimezoneOffset() * 60000);

    return local.toISOString().slice(0, 16);
  }

  function displayDate(isoDate) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);

    if (!parts) {
      throw new Error("Enter a valid date.");
    }

    const date = new Date(
      Number(parts[1]),
      Number(parts[2]) - 1,
      Number(parts[3])
    );

    if (date.getFullYear() !== Number(parts[1]) ||
        date.getMonth() !== Number(parts[2]) - 1 ||
        date.getDate() !== Number(parts[3])) {
      throw new Error("Enter a valid date.");
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function attachLogo(fileInputId, removeButtonId, imageId, onChange) {
    const input = byId(fileInputId);
    const image = byId(imageId);

    input.addEventListener("change", async () => {
      CVTools.showError("");

      const file = input.files[0];

      if (!file) return;

      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 1048576
      ) {
        input.value = "";
        CVTools.showError(
          "Choose a PNG, JPG or WebP logo no larger than 1 MB."
        );
        return;
      }

      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(
            new Error("Could not read that logo.")
          );
          reader.readAsDataURL(file);
        });

        // Confirm that the selected file can actually be decoded as an image.
        const testImage = new Image();
        testImage.src = dataUrl;
        await testImage.decode();

        image.src = dataUrl;
        image.hidden = false;
        onChange();
      } catch (_) {
        CVTools.showError(
          "That logo could not be opened. Try another PNG, JPG or WebP file."
        );
      } finally {
        input.value = "";
      }
    });

    byId(removeButtonId).addEventListener("click", () => {
      image.removeAttribute("src");
      image.hidden = true;
      input.value = "";
      CVTools.showError("");
      onChange();
    });
  }

  function listenForChanges(container, render) {
    container.addEventListener("input", () => {
      CVTools.showError("");
      render();
    });

    container.addEventListener("change", () => {
      CVTools.showError("");
      render();
    });
  }

  window.CVDocument = {
    byId,
    value,
    setText,
    setOptional,
    money,
    toCents,
    percentage,
    quantity,
    todayLocal,
    nowLocal,
    displayDate,
    attachLogo,
    listenForChanges
  };
})();
