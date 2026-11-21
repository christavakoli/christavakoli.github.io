"use strict";

(() => {
  const D = window.CVDocument;
  const itemsContainer = D.byId("inv-items");
  const outputItems = D.byId("out-inv-items");
  const currencyInput = D.byId("inv-currency");

  function addItem(description = "", quantity = "1", price = "0.00") {
    const item = document.createElement("div");
    item.className = "editable-item";

    const heading = document.createElement("strong");
    heading.textContent = "Invoice item";

    const descriptionLabel = document.createElement("label");
    descriptionLabel.textContent = "Description";
    const descriptionInput = document.createElement("input");
    descriptionInput.type = "text";
    descriptionInput.className = "item-description";
    descriptionInput.maxLength = 160;
    descriptionInput.placeholder = "Product or service";
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

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn";
    remove.textContent = "Remove item";
    remove.addEventListener("click", () => {
      item.remove();
      render();
    });

    item.append(heading, descriptionLabel, columns, remove);
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

      // An unused default item does not appear in the preview.
      if (!description && !strict) continue;

      if (!description) {
        throw new Error(
          "Every invoice item needs a description. Remove unused items."
        );
      }

      const quantity = D.quantity(quantityText);
      const unitCents = D.toCents(priceText, "Unit price");
      const amountCents = Math.round(quantity * unitCents);

      if (amountCents > 1000000000) {
        throw new Error(
          "An invoice item exceeds the maximum supported amount."
        );
      }

      rows.push({
        description,
        quantity,
        unitCents,
        amountCents
      });
    }

    if (strict && rows.length === 0) {
      throw new Error("Add at least one completed invoice item.");
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
        "The invoice subtotal exceeds the maximum supported amount."
      );
    }

    const discount = D.toCents(
      D.byId("inv-discount").value,
      "Discount"
    );

    if (discount > subtotal) {
      throw new Error(
        "The discount cannot exceed the invoice subtotal."
      );
    }

    const taxRate = D.percentage(
      D.byId("inv-tax").value,
      "Tax rate"
    );

    const taxable = subtotal - discount;
    const tax = Math.round(taxable * taxRate / 100);
    const total = taxable + tax;

    if (total > 1000000000) {
      throw new Error(
        "The invoice total exceeds the maximum supported amount."
      );
    }

    return { subtotal, discount, taxRate, tax, total };
  }

  function putItemRows(rows, currency) {
    outputItems.replaceChildren();

    for (const row of rows) {
      const tr = document.createElement("tr");

      for (const text of [
        row.description,
        String(row.quantity),
        D.money(row.unitCents, currency),
        D.money(row.amountCents, currency)
      ]) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.append(td);
      }

      outputItems.append(tr);
    }

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "Add an item to preview your invoice.";
      tr.append(td);
      outputItems.append(tr);
    }
  }

  function showTotals(totals, currency) {
    D.setText(
      "out-inv-subtotal",
      D.money(totals.subtotal, currency)
    );
    D.setText(
      "out-inv-discount",
      `−${D.money(totals.discount, currency)}`
    );
    D.setText(
      "out-inv-tax-label",
      `Tax (${totals.taxRate}%)`
    );
    D.setText("out-inv-tax", D.money(totals.tax, currency));
    D.setText("out-inv-total", D.money(totals.total, currency));
  }

  function showInvalidTotals() {
    for (const id of [
      "out-inv-subtotal",
      "out-inv-discount",
      "out-inv-tax",
      "out-inv-total"
    ]) {
      D.setText(id, "—");
    }

    D.setText("out-inv-tax-label", "Tax");
  }

  function render() {
    const currency = currencyInput.value;

    D.setText(
      "out-inv-business",
      D.value("inv-business") || "Your business"
    );
    D.setText("out-inv-address", D.value("inv-address"));

    const contact = [
      D.value("inv-email"),
      D.value("inv-phone")
    ].filter(Boolean).join(" · ");

    D.setText("out-inv-contact", contact);
    D.setText(
      "out-inv-number",
      D.value("inv-number") || "Invoice number"
    );
    D.setText(
      "out-inv-customer",
      D.value("inv-customer") || "Customer name"
    );
    D.setText(
      "out-inv-customer-address",
      D.value("inv-customer-address")
    );

    for (const [inputId, outputId] of [
      ["inv-date", "out-inv-date"],
      ["inv-due", "out-inv-due"]
    ]) {
      try {
        D.setText(
          outputId,
          D.byId(inputId).value
            ? D.displayDate(D.byId(inputId).value)
            : "—"
        );
      } catch (_) {
        D.setText(outputId, "—");
      }
    }

    const payment = D.value("inv-payment");
    D.setText("out-inv-payment", payment);
    D.byId("out-inv-payment-block").hidden = !payment;

    const notes = D.value("inv-notes");
    D.setText("out-inv-notes", notes);
    D.byId("out-inv-notes-block").hidden = !notes;

    try {
      const rows = readItems(false);
      putItemRows(rows, currency);
      showTotals(totalsFor(rows), currency);
    } catch (_) {
      // Keep the preview usable while someone is editing an incomplete value.
      outputItems.replaceChildren();
      showInvalidTotals();
    }
  }

  function validateBeforePrinting() {
    if (!D.value("inv-business")) {
      throw new Error("Enter your business name.");
    }

    if (!D.value("inv-customer")) {
      throw new Error("Enter the customer or company name.");
    }

    if (!D.value("inv-number")) {
      throw new Error("Enter an invoice number.");
    }

    const issueDate = D.byId("inv-date").value;
    const dueDate = D.byId("inv-due").value;

    if (!issueDate || !dueDate) {
      throw new Error("Enter both an issue date and a due date.");
    }

    D.displayDate(issueDate);
    D.displayDate(dueDate);

    if (dueDate < issueDate) {
      throw new Error(
        "The due date cannot be earlier than the issue date."
      );
    }

    const email = D.value("inv-email");

    if (email && !D.byId("inv-email").checkValidity()) {
      throw new Error("Enter a valid business email address.");
    }

    const rows = readItems(true);
    totalsFor(rows);
  }

  D.listenForChanges(
    document.querySelector(".document-editor"),
    render
  );

  D.attachLogo(
    "inv-logo",
    "inv-remove-logo",
    "out-inv-logo",
    render
  );

  D.byId("inv-add-item").addEventListener("click", () => {
    addItem();
    itemsContainer
      .lastElementChild
      .querySelector(".item-description")
      .focus();
  });

  D.byId("inv-print").addEventListener("click", () => {
    CVTools.showError("");

    try {
      validateBeforePrinting();
      render();
      window.print();
    } catch (error) {
      CVTools.showError(
        error.message || "Check your invoice details before printing."
      );
    }
  });

  const today = D.todayLocal();
  const due = new Date(`${today}T12:00:00`);
  due.setDate(due.getDate() + 14);

  const localDue = new Date(
    due.getTime() - due.getTimezoneOffset() * 60000
  );

  D.byId("inv-date").value = today;
  D.byId("inv-due").value = localDue.toISOString().slice(0, 10);
  D.byId("inv-number").value =
    `INV-${today.replace(/-/g, "")}`;
  D.byId("inv-notes").value =
    "Thank you for your business.";

  addItem();
  render();
})();
