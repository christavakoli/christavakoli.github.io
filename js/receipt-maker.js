"use strict";

(() => {
  const D = window.CVDocument;
  const itemsContainer = D.byId("rec-items");
  const outputItems = D.byId("out-rec-items");
  const currencyInput = D.byId("rec-currency");

  // Code 39 encodings for the ten digits and the start/stop symbol.
  // Each nine-element pattern alternates bar/space, starting with a bar.
  // A set bit represents a wide element.
  const digitPatterns = [
    0x034, 0x121, 0x061, 0x160, 0x031,
    0x130, 0x070, 0x025, 0x124, 0x064
  ];
  const startStopPattern = 0x094;
  const svgNamespace = "http://www.w3.org/2000/svg";

  function addItem(
    description = "",
    quantity = "1",
    price = "0.00",
    reference = ""
  ) {
    const item = document.createElement("div");
    item.className = "editable-item";

    const heading = document.createElement("strong");
    heading.textContent = "Receipt item";

    const descriptionLabel = document.createElement("label");
    descriptionLabel.textContent = "Item description";
    const descriptionInput = document.createElement("input");
    descriptionInput.type = "text";
    descriptionInput.className = "item-description";
    descriptionInput.maxLength = 120;
    descriptionInput.placeholder = "Item name";
    descriptionInput.value = description;
    descriptionLabel.append(descriptionInput);

    const columns = document.createElement("div");
    columns.className = "cols-2";

    const quantityLabel = document.createElement("label");
    quantityLabel.textContent = "Quantity";
    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.className = "item-quantity";
    quantityInput.min = "0.001";
    quantityInput.max = "100000";
    quantityInput.step = "0.001";
    quantityInput.value = quantity;
    quantityLabel.append(quantityInput);

    const priceLabel = document.createElement("label");
    priceLabel.textContent = "Unit price";
    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.className = "item-price";
    priceInput.min = "0";
    priceInput.max = "1000000";
    priceInput.step = "0.01";
    priceInput.value = price;
    priceLabel.append(priceInput);

    columns.append(quantityLabel, priceLabel);

    const referenceLabel = document.createElement("label");
    referenceLabel.textContent =
      "Item code / SKU (optional)";
    const referenceInput = document.createElement("input");
    referenceInput.type = "text";
    referenceInput.className = "item-reference";
    referenceInput.maxLength = 45;
    referenceInput.value = reference;
    referenceLabel.append(referenceInput);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn";
    remove.textContent = "Remove item";
    remove.addEventListener("click", () => {
      item.remove();
      render();
    });

    item.append(
      heading,
      descriptionLabel,
      columns,
      referenceLabel,
      remove
    );

    itemsContainer.append(item);
    render();
  }

  function readItems(strict) {
    const rows = [];

    for (const item of itemsContainer.querySelectorAll(".editable-item")) {
      const description =
        item.querySelector(".item-description").value.trim();
      const quantityText =
        item.querySelector(".item-quantity").value;
      const priceText =
        item.querySelector(".item-price").value;
      const reference =
        item.querySelector(".item-reference").value.trim();

      if (!description && !strict) continue;

      if (!description) {
        throw new Error(
          "Every receipt item needs a description. Remove unused items."
        );
      }

      const quantity = D.quantity(quantityText);
      const unitCents = D.toCents(priceText, "Unit price");
      const amountCents = Math.round(quantity * unitCents);

      if (amountCents > 1000000000) {
        throw new Error(
          "A receipt item exceeds the maximum supported amount."
        );
      }

      rows.push({
        description,
        quantity,
        unitCents,
        amountCents,
        reference
      });
    }

    if (strict && rows.length === 0) {
      throw new Error("Add at least one completed receipt item.");
    }

    return rows;
  }

  function totalsFor(rows) {
    const subtotal = rows.reduce(
      (sum, row) => sum + row.amountCents,
      0
    );

    if (subtotal > 1000000000) {
      throw new Error(
        "The receipt subtotal exceeds the maximum supported amount."
      );
    }

    const taxRate = D.percentage(
      D.byId("rec-tax").value,
      "Tax rate"
    );

    const tax = Math.round(subtotal * taxRate / 100);
    const total = subtotal + tax;

    if (total > 1000000000) {
      throw new Error(
        "The receipt total exceeds the maximum supported amount."
      );
    }

    return { subtotal, taxRate, tax, total };
  }

  function putItemRows(rows, currency) {
    outputItems.replaceChildren();

    for (const row of rows) {
      const item = document.createElement("div");
      item.className = "receipt-item";

      const main = document.createElement("div");
      main.className = "receipt-item-main";

      const description = document.createElement("span");
      description.textContent = row.description;

      const amount = document.createElement("span");
      amount.textContent = D.money(
        row.amountCents,
        currency
      );

      main.append(description, amount);
      item.append(main);

      const detail = document.createElement("div");
      detail.className = "receipt-item-detail";
      detail.textContent =
        `${row.quantity} × ${D.money(row.unitCents, currency)}`;
      item.append(detail);

      if (row.reference) {
        const reference = document.createElement("div");
        reference.className = "receipt-item-detail";
        reference.textContent = row.reference;
        item.append(reference);
      }

      outputItems.append(item);
    }

    if (rows.length === 0) {
      const message = document.createElement("p");
      message.textContent = "Add an item to preview your receipt.";
      outputItems.append(message);
    }
  }

  function showInvalidTotals() {
    for (const id of [
      "out-rec-subtotal",
      "out-rec-tax",
      "out-rec-total",
      "out-rec-payment-total"
    ]) {
      D.setText(id, "—");
    }

    D.setText("out-rec-tax-label", "TAX");
  }

  function dateTimeForDisplay(raw) {
    const match =
      /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(raw);

    if (!match) {
      throw new Error("Enter a valid receipt date and time.");
    }

    D.displayDate(match[1]);

    const hours = Number(match[2]);
    const minutes = Number(match[3]);

    if (hours > 23 || minutes > 59) {
      throw new Error("Enter a valid receipt time.");
    }

    return `${D.displayDate(match[1])} ` +
      `${String(hours).padStart(2, "0")}:` +
      `${String(minutes).padStart(2, "0")}`;
  }

  function appendPattern(svg, pattern, state) {
    let position = state.position;

    for (let index = 0; index < 9; index++) {
      const wide =
        (pattern & (1 << (8 - index))) !== 0;

      const width = wide ? 2.5 : 1;

      if (index % 2 === 0) {
        const bar = document.createElementNS(
          svgNamespace,
          "rect"
        );

        bar.setAttribute("x", String(position));
        bar.setAttribute("y", "0");
        bar.setAttribute("width", String(width));
        bar.setAttribute("height", "48");
        bar.setAttribute("fill", "#000000");
        svg.append(bar);
      }

      position += width;
    }

    state.position = position;
  }

  function drawBarcode(value) {
    const block = D.byId("out-rec-barcode-block");
    const svg = D.byId("out-rec-barcode-svg");

    svg.replaceChildren();
    D.setText("out-rec-barcode-number", value);
    block.hidden = !value;

    if (!value || !/^\d{1,18}$/.test(value)) {
      block.hidden = true;
      return;
    }

    // Ten narrow-element widths of whitespace on both sides.
    const state = { position: 10 };

    appendPattern(svg, startStopPattern, state);
    state.position += 1; // Inter-character gap.

    for (const digit of value) {
      appendPattern(
        svg,
        digitPatterns[Number(digit)],
        state
      );

      state.position += 1;
    }

    appendPattern(svg, startStopPattern, state);

    const totalWidth = state.position + 10;

    svg.setAttribute(
      "viewBox",
      `0 0 ${totalWidth} 48`
    );
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    );
  }

  function render() {
    const currency = currencyInput.value;

    D.setText(
      "out-rec-store",
      D.value("rec-store") || "Your store"
    );
    D.setText(
      "out-rec-website",
      D.value("rec-website")
    );

    const storeNumber = D.value("rec-store-number");

    D.setText(
      "out-rec-store-number",
      storeNumber ? `Store: ${storeNumber}` : ""
    );

    const phone = D.value("rec-phone");

    D.setText(
      "out-rec-phone",
      phone ? `Telephone: ${phone}` : ""
    );

    D.setText(
      "out-rec-address",
      D.value("rec-address")
    );

    const taxId = D.value("rec-tax-id");

    D.setText(
      "out-rec-tax-id",
      taxId ? `Tax / VAT ID: ${taxId}` : ""
    );

    const intro = D.value("rec-intro");

    D.setText("out-rec-intro", intro);
    D.byId("out-rec-intro").hidden = !intro;

    D.setText(
      "out-rec-copy",
      D.value("rec-copy") || "CUSTOMER COPY"
    );

    D.setText(
      "out-rec-number",
      D.value("rec-number") || "—"
    );

    try {
      const rawDate = D.byId("rec-datetime").value;

      D.setText(
        "out-rec-datetime",
        rawDate ? dateTimeForDisplay(rawDate) : "—"
      );
    } catch (_) {
      D.setText("out-rec-datetime", "—");
    }

    const cashier = D.value("rec-cashier");

    D.setText("out-rec-cashier", cashier);
    D.byId("out-rec-cashier-line").hidden = !cashier;

    const method = D.value("rec-payment-method");

    D.setText("out-rec-payment-method", method);
    D.byId("out-rec-payment-block").hidden = !method;

    const lastFour = D.value("rec-card-last4");

    D.setText("out-rec-card-last4", lastFour);
    D.byId("out-rec-card-line").hidden = !lastFour;

    const authorization = D.value("rec-auth");

    D.setText("out-rec-auth", authorization);
    D.byId("out-rec-auth-line").hidden =
      !authorization;

    const policy = D.value("rec-policy");

    D.setText("out-rec-policy", policy);
    D.byId("out-rec-policy").hidden = !policy;

    drawBarcode(D.value("rec-barcode"));

    try {
      const rows = readItems(false);
      const totals = totalsFor(rows);

      putItemRows(rows, currency);

      D.setText(
        "out-rec-subtotal",
        D.money(totals.subtotal, currency)
      );
      D.setText(
        "out-rec-tax-label",
        `TAX (${totals.taxRate}%)`
      );
      D.setText(
        "out-rec-tax",
        D.money(totals.tax, currency)
      );
      D.setText(
        "out-rec-total",
        D.money(totals.total, currency)
      );
      D.setText(
        "out-rec-payment-total",
        D.money(totals.total, currency)
      );
    } catch (_) {
      outputItems.replaceChildren();
      showInvalidTotals();
    }
  }

  function validateBeforePrinting() {
    if (!D.value("rec-store")) {
      throw new Error("Enter the store or business name.");
    }

    if (!D.value("rec-number")) {
      throw new Error("Enter a receipt number.");
    }

    dateTimeForDisplay(
      D.byId("rec-datetime").value
    );

    const lastFour = D.value("rec-card-last4");

    if (lastFour && !/^\d{4}$/.test(lastFour)) {
      throw new Error(
        "Enter exactly four digits for the optional card ending."
      );
    }

    if (lastFour &&
        !D.value("rec-payment-method")) {
      throw new Error(
        "Enter a payment method when showing a card ending."
      );
    }

    const barcode = D.value("rec-barcode");

    if (barcode &&
        !/^\d{1,18}$/.test(barcode)) {
      throw new Error(
        "The optional barcode reference must contain 1–18 digits only."
      );
    }

    const rows = readItems(true);
    totalsFor(rows);
  }

  D.listenForChanges(
    document.querySelector(".document-editor"),
    render
  );

  D.attachLogo(
    "rec-logo",
    "rec-remove-logo",
    "out-rec-logo",
    render
  );

  D.byId("rec-add-item")
    .addEventListener("click", () => {
      addItem();

      itemsContainer
        .lastElementChild
        .querySelector(".item-description")
        .focus();
    });

  D.byId("rec-print")
    .addEventListener("click", () => {
      CVTools.showError("");

      try {
        validateBeforePrinting();
        render();
        window.print();
      } catch (error) {
        CVTools.showError(
          error.message ||
          "Check your receipt details before printing."
        );
      }
    });

  D.byId("rec-datetime").value = D.nowLocal();
  D.byId("rec-number").value =
    `R-${D.todayLocal().replace(/-/g, "")}`;
  D.byId("rec-intro").value =
    "Please retain this receipt for your records.";
  D.byId("rec-policy").value =
    "Thank you for your purchase.";

  addItem();
  render();
})();
