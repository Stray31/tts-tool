    const savedFieldOptions = JSON.parse(localStorage.getItem("field-options") || "null");
    let defaultFieldOptions;
    let sharedOptionsAvailable = true;
    try {
      const response = await fetch("./dropdown-options.json");
      if (!response.ok) throw new Error(`Could not load dropdown-options.json (${response.status}).`);
      defaultFieldOptions = await response.json();
      if (!defaultFieldOptions || Array.from({ length: 10 }, (_, index) =>
        !Array.isArray(defaultFieldOptions[index]) ||
        !defaultFieldOptions[index].every(option => typeof option === "string")
      ).some(isInvalid => isInvalid)) {
        throw new Error("dropdown-options.json must contain a string-array for each of the 10 fields.");
      }
    } catch (error) {
      if (savedFieldOptions) {
        sharedOptionsAvailable = false;
        console.warn("Shared dropdown defaults could not be loaded; keeping this browser's saved options.", error);
        defaultFieldOptions = savedFieldOptions;
      } else {
        console.error("Could not load dropdown-options.json. Serve this site over HTTP(S) to load shared defaults.", error);
        const notice = document.createElement("p");
        notice.setAttribute("role", "alert");
        notice.textContent = "Could not load dropdown-options.json. Open this site through GitHub Pages or a local web server.";
        document.body.prepend(notice);
        throw error;
      }
    }

    const cloneOptions = options => JSON.parse(JSON.stringify(options));
    let fieldOptions = savedFieldOptions || cloneOptions(defaultFieldOptions);
    let clearHistory = JSON.parse(localStorage.getItem("clear-history") || "null");

    const fields = [
      "Intro", "MPI Route", "Inspection", "Digital Tire Gauge",
      "Brake Gauge", "Gloves & Pointer", "Explain", "MPI Words",
      "Outro", "Clarity"
    ];

    const form = document.getElementById("form");
    const quickNotes = document.getElementById("quickNotes");
    const inputs = [];
    const textMeasureCanvas = document.createElement("canvas");
    const textMeasureContext = textMeasureCanvas.getContext("2d");
    const importZone = document.getElementById("optionsImport");
    const importFileInput = document.getElementById("importOptionsFile");
    const importStatus = document.getElementById("optionsImportStatus");

    if (!sharedOptionsAvailable) {
      importStatus.textContent = "Starter options could not be loaded, but you can still import an options file.";
    }

    function onWindowLoad(callback) {
      if (document.readyState === "complete") {
        callback();
      } else {
        window.addEventListener("load", callback, { once: true });
      }
    }

    function updateHistoryButtons() {
      document.getElementById("historyBack").disabled = clearHistory?.position !== "after-clear";
      document.getElementById("historyForward").disabled = clearHistory?.position !== "before-clear";
    }

    function invalidateClearHistory() {
      if (clearHistory) {
        clearHistory = null;
        localStorage.removeItem("clear-history");
        updateHistoryButtons();
      }
    }

    onWindowLoad(() => {
      const saved = JSON.parse(localStorage.getItem("qa-data") || "{}");
      quickNotes.value = localStorage.getItem("quick-notes-data") || "";

      inputs.forEach((i, idx) => {
        if (saved.main?.[idx]) i.value = saved.main[idx];
      });

      updateHistoryButtons();
      inputs[0]?.focus();
    });

    function positionDropdown(wrapper, menu) {
      menu.style.top = "calc(100% + 4px)";
      menu.style.bottom = "auto";
      menu.style.left = "auto";
      menu.style.right = "0";

      const wrapperRect = wrapper.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const spaceBelow = window.innerHeight - wrapperRect.bottom;
      const spaceAbove = wrapperRect.top;

      if (menuRect.height > spaceBelow && spaceAbove > spaceBelow) {
        menu.style.top = "auto";
        menu.style.bottom = "calc(100% + 4px)";
      }

      const positionedMenu = menu.getBoundingClientRect();
      if (positionedMenu.left < 12) {
        menu.style.left = `${12 - wrapperRect.left}px`;
        menu.style.right = "auto";
      } else if (positionedMenu.right > window.innerWidth - 12) {
        menu.style.left = `${window.innerWidth - 12 - wrapperRect.left - positionedMenu.width}px`;
        menu.style.right = "auto";
      }
    }

    function createDropdownMenu(input, index) {
      const dropdownMenu = document.createElement("div");
      dropdownMenu.className = "field-dropdown-menu";
      dropdownMenu.id = `dropdown-menu-${index}`;

      (fieldOptions[index] || ["Option 1", "Option 2", "Option 3"]).forEach(optionText => {
        const option = document.createElement("button");
        option.type = "button";
        option.textContent = optionText;
        option.addEventListener("click", event => {
          event.preventDefault();
          input.value = (input.value.trim() ? input.value + " " : "") + optionText;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          dropdownMenu.classList.remove("show");
          dropdownMenu.parentElement.querySelector(".field-dropdown-btn").setAttribute("aria-expanded", "false");
          input.focus();
        });
        dropdownMenu.appendChild(option);
      });

      return dropdownMenu;
    }

    function findSuggestion(input, index) {
      const value = input.value;
      if (!value || input.selectionStart !== value.length) return "";

      const options = fieldOptions[index] || [];
      const normalizedValue = value.toLocaleLowerCase();
      const fullValueMatch = options.find(option =>
        option.toLocaleLowerCase().startsWith(normalizedValue) &&
        option.toLocaleLowerCase() !== normalizedValue
      );
      if (fullValueMatch) {
        return {
          value: fullValueMatch,
          suffix: fullValueMatch.slice(value.length)
        };
      }

      const trailingFragment = value.match(/\S+$/)?.[0];
      if (!trailingFragment) return "";
      const normalizedFragment = trailingFragment.toLocaleLowerCase();
      const tokenMatch = options.find(option =>
        option.toLocaleLowerCase().startsWith(normalizedFragment) &&
        option.toLocaleLowerCase() !== normalizedFragment
      );
      if (!tokenMatch) return "";

      return {
        value: value + tokenMatch.slice(trailingFragment.length),
        suffix: tokenMatch.slice(trailingFragment.length)
      };
    }

    function updateSuggestion(input, index, preview) {
      const suggestion = findSuggestion(input, index);
      if (!suggestion) {
        preview.textContent = "";
        preview.hidden = true;
        return;
      }

      const style = window.getComputedStyle(input);
      textMeasureContext.font = style.font;
      const left = parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft) + textMeasureContext.measureText(input.value).width;
      preview.style.left = `${left}px`;
      preview.style.maxWidth = `${Math.max(0, input.clientWidth - left - 48)}px`;
      preview.style.fontFamily = style.fontFamily;
      preview.style.fontSize = style.fontSize;
      preview.style.fontWeight = style.fontWeight;
      preview.style.fontStyle = style.fontStyle;
      preview.style.fontVariant = style.fontVariant;
      preview.style.letterSpacing = style.letterSpacing;
      preview.style.lineHeight = style.lineHeight;
      preview.style.paddingTop = style.paddingTop;
      preview.textContent = suggestion.suffix;
      preview.hidden = false;
    }

    function closeDropdowns() {
      document.querySelectorAll(".field-dropdown-menu.show").forEach(menu => {
        menu.classList.remove("show");
        menu.parentElement.querySelector(".field-dropdown-btn").setAttribute("aria-expanded", "false");
      });
    }

    fields.forEach((field, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "field";

      const input = document.createElement("input");
      input.placeholder = " ";

      const suggestionPreview = document.createElement("span");
      suggestionPreview.className = "field-suggestion";
      suggestionPreview.setAttribute("aria-hidden", "true");
      suggestionPreview.hidden = true;

      const label = document.createElement("label");
      label.textContent = field;

      input.addEventListener("input", () => {
        saveData();
        updateSuggestion(input, index, suggestionPreview);
      });
      input.addEventListener("keyup", () => updateSuggestion(input, index, suggestionPreview));
      input.addEventListener("click", () => updateSuggestion(input, index, suggestionPreview));
      input.addEventListener("blur", () => {
        suggestionPreview.hidden = true;
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Tab" && !e.shiftKey && input.value.trim()) {
          const suggestion = findSuggestion(input, index);
          if (suggestion) {
            e.preventDefault();
            input.value = suggestion.value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            return;
          }
        }
        if (e.key === "Enter") {
          e.preventDefault();
          inputs[index + 1]?.focus();
        }
        if (e.key === "F1") {
          e.preventDefault();
          inputs[index - 1]?.focus();
        }
      });
      input.addEventListener("focus", () => {
        setTimeout(() => {
          input.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }, 80);
      });

      // Create dropdown button
      const dropdownBtn = document.createElement("button");
      dropdownBtn.className = "field-dropdown-btn";
      dropdownBtn.textContent = "▼";
      dropdownBtn.type = "button";
      dropdownBtn.setAttribute("data-dropdown-index", index);
      dropdownBtn.setAttribute("aria-label", `Show ${field} options`);
      dropdownBtn.setAttribute("aria-expanded", "false");

      // Create dropdown menu
      const dropdownMenu = createDropdownMenu(input, index);

      dropdownBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropdownMenu = wrapper.querySelector(".field-dropdown-menu");
        if (!dropdownMenu) return;
        const shouldOpen = !dropdownMenu.classList.contains("show");
        closeDropdowns();
        dropdownMenu.classList.toggle("show", shouldOpen);
        dropdownBtn.setAttribute("aria-expanded", String(shouldOpen));
        if (shouldOpen) positionDropdown(wrapper, dropdownMenu);
      });

      // Close menu when clicking outside
      document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) {
          wrapper.querySelector(".field-dropdown-menu")?.classList.remove("show");
          dropdownBtn.setAttribute("aria-expanded", "false");
        }
      });

      inputs.push(input);
      wrapper.appendChild(input);
      wrapper.appendChild(suggestionPreview);
      wrapper.appendChild(label);
      wrapper.appendChild(dropdownBtn);
      wrapper.appendChild(dropdownMenu);
      form.appendChild(wrapper);
    });

    function repositionOpenDropdowns() {
      document.querySelectorAll(".field-dropdown-menu.show").forEach(menu => {
        positionDropdown(menu.parentElement, menu);
      });
    }

    window.addEventListener("resize", repositionOpenDropdowns);
    window.addEventListener("scroll", repositionOpenDropdowns, true);

    function saveData() {
      const data = {
        main: inputs.map(i => i.value)
      };
      localStorage.setItem("qa-data", JSON.stringify(data));
      invalidateClearHistory();
    }

    function createFormSnapshot() {
      return {
        main: inputs.map(input => input.value),
        quickNotes: document.getElementById("quickNotes").value,
        output: document.getElementById("output").value,
        marks: document.getElementById("okFields").innerHTML,
        okCount: document.getElementById("okCount").textContent,
        notOkCount: document.getElementById("notOkCount").textContent,
        attention: inputs.map(input => input.classList.contains("attention"))
      };
    }

    function applyFormSnapshot(snapshot) {
      inputs.forEach((input, index) => {
        input.value = snapshot.main[index] || "";
        input.classList.toggle("attention", Boolean(snapshot.attention[index]));
      });
      document.getElementById("quickNotes").value = snapshot.quickNotes || "";
      document.getElementById("output").value = snapshot.output || "";
      document.getElementById("okFields").innerHTML = snapshot.marks || "";
      document.getElementById("okCount").textContent = snapshot.okCount || "0";
      document.getElementById("notOkCount").textContent = snapshot.notOkCount || "0";
      localStorage.setItem("quick-notes-data", snapshot.quickNotes || "");
      localStorage.setItem("qa-data", JSON.stringify({ main: snapshot.main }));
    }

    function scrollToMarks() {
      document.getElementById("marksHeader").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    function updateResults() {
      const emptyFields = [];
      inputs.forEach((input, i) => {
        if (!input.value.trim()) {
          emptyFields.push(fields[i]);
        }
      });

      if (emptyFields.length > 0) {
        showCustomAlert(`Please fill in: ${emptyFields.join(", ")}`);
        return null;
      }

      let marksList = "";
      let redList = "";
      let greenCount = 0;
      let redCount = 0;

      inputs.forEach((input, i) => {
        const value = input.value.trim();

        // clear previous highlights first
        input.classList.remove("attention");

        // Check if value is "ok" or "OK"
        const isOk = value.toLowerCase() === "ok";

        if (isOk) {
          marksList += `<div class="mark-item mark-green">${fields[i]}: <strong>Green</strong></div>`;
          greenCount++;
        } else if (value) {
          marksList += `<div class="mark-item mark-red">${fields[i]}: <strong>Red</strong></div>`;
          redList += `${fields[i]}: ${value}\n`;
          input.classList.add("attention");
          redCount++;
        } else {
          // Empty field counts as Red
          marksList += `<div class="mark-item mark-red">${fields[i]}: <strong>Red</strong></div>`;
          redCount++;
        }
      });

      document.getElementById("okFields").innerHTML = marksList;
      document.getElementById("output").value = redList;
      document.getElementById("notOkCount").textContent = redCount;
      document.getElementById("okCount").textContent = greenCount;

      return redList;
    }

    async function copyTextToClipboard(text) {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          showCustomAlert("Results copied to clipboard!");
          return;
        }
      } catch (error) {
        console.warn("Clipboard API failed; trying the browser copy command.", error);
      }

      const temporaryInput = document.createElement("textarea");
      temporaryInput.value = text || " ";
      temporaryInput.style.position = "fixed";
      temporaryInput.style.opacity = "0";
      document.body.appendChild(temporaryInput);
      temporaryInput.focus();
      temporaryInput.select();
      temporaryInput.setSelectionRange(0, temporaryInput.value.length);

      let copyEventHandled = false;
      const handleCopy = event => {
        if (!event.clipboardData) {
          event.preventDefault();
          return;
        }
        try {
          event.clipboardData.setData("text/plain", text);
          copyEventHandled = true;
        } catch (error) {
          console.warn("Could not write to the legacy clipboard event.", error);
        }
        event.preventDefault();
      };
      document.addEventListener("copy", handleCopy);
      let commandSucceeded = false;
      try {
        commandSucceeded = document.execCommand("copy");
      } catch (error) {
        console.warn("Browser copy command failed.", error);
      } finally {
        document.removeEventListener("copy", handleCopy);
        temporaryInput.remove();
      }

      if (commandSucceeded && (text !== "" || copyEventHandled)) {
        showCustomAlert("Results copied to clipboard!");
      } else {
        showCustomAlert("Could not update the clipboard. Please allow clipboard access and try again.");
      }
    }

    async function generate() {
      const redText = updateResults();
      if (redText === null) return;
      scrollToMarks();
      await copyTextToClipboard(redText);
    }

    function clearFields() {
      const previousSnapshot = createFormSnapshot();
      inputs.forEach(i => i.classList.remove("attention"));
      inputs.forEach(i => i.value = "");
      localStorage.removeItem("qa-data");
      document.getElementById("output").value = "";
      document.getElementById("okFields").innerHTML = "";
      document.getElementById("notOkCount").textContent = "0";
      document.getElementById("okCount").textContent = "0";
      quickNotes.value = "";
      localStorage.removeItem("quick-notes-data");

      clearHistory = {
        beforeClear: previousSnapshot,
        afterClear: createFormSnapshot(),
        position: "after-clear"
      };
      localStorage.setItem("clear-history", JSON.stringify(clearHistory));
      updateHistoryButtons();

      inputs[0].focus();

      // ✅ scroll to top after reset
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }

    document.getElementById("historyBack").addEventListener("click", () => {
      if (!clearHistory || clearHistory.position !== "after-clear") return;
      applyFormSnapshot(clearHistory.beforeClear);
      clearHistory.position = "before-clear";
      localStorage.setItem("clear-history", JSON.stringify(clearHistory));
      updateHistoryButtons();
    });

    document.getElementById("historyForward").addEventListener("click", () => {
      if (!clearHistory || clearHistory.position !== "before-clear") return;
      applyFormSnapshot(clearHistory.afterClear);
      clearHistory.position = "after-clear";
      localStorage.setItem("clear-history", JSON.stringify(clearHistory));
      updateHistoryButtons();
    });

    quickNotes.addEventListener("input", () => {
      localStorage.setItem("quick-notes-data", quickNotes.value);
      invalidateClearHistory();
    });


    document.getElementById("theme").onclick = () => {
      document.body.classList.toggle("dark");
      document.getElementById("theme").textContent =
        document.body.classList.contains("dark") ? "🌙" : "☀️";
      localStorage.setItem("theme-mode", document.body.classList.contains("dark") ? "dark" : "light");
    };

    // Set initial theme icon on page load
    onWindowLoad(() => {
      const savedTheme = localStorage.getItem("theme-mode");
      if (savedTheme === "dark") {
        document.body.classList.add("dark");
      }
      document.getElementById("theme").textContent =
        document.body.classList.contains("dark") ? "🌙" : "☀️";
    });

    document.getElementById("generate").onclick = generate;
    document.getElementById("clear").onclick = clearFields;
    document.getElementById("copy").onclick = async () => {
      const redText = updateResults();
      if (redText === null) return;
      scrollToMarks();
      await copyTextToClipboard(redText);
    };



    const commentsBox = document.getElementById("commentsBox");

    // LOAD
    onWindowLoad(() => {
      const saved = localStorage.getItem("comments-data");
      commentsBox.value = saved || "";
    });

    // SAVE
    document.getElementById("saveComments").onclick = () => {
      localStorage.setItem("comments-data", commentsBox.value);
      showCustomAlert("Comments saved!");
    };

    // RESET
    document.getElementById("resetComments").onclick = () => {
      commentsBox.value = "";
      localStorage.removeItem("comments-data");
    };

    // Custom Alert Function
    function showCustomAlert(message) {
      const alertEl = document.getElementById("customAlert");
      const textEl = alertEl.querySelector(".custom-alert-text");
      textEl.textContent = message;

      alertEl.classList.add("show");

      setTimeout(() => {
        alertEl.classList.remove("show");
      }, 1000);
    }

    // Comments Sidebar Toggle
    document.getElementById("commentsToggle").addEventListener("click", () => {
      document.getElementById("commentsSidebar").classList.toggle("show");
    });

    document.getElementById("commentsClose").addEventListener("click", () => {
      document.getElementById("commentsSidebar").classList.remove("show");
    });

    // Settings Panel Functionality
    let activeOptionDrag = null;
    let optionDragFrame = 0;

    function moveOptionItem(list, item, before) {
      if (before === item || before === item.nextElementSibling) return;

      const previousPositions = new Map(
        Array.from(list.children, child => [child, child.getBoundingClientRect().top])
      );
      list.insertBefore(item, before);

      previousPositions.forEach((previousTop, child) => {
        if (child === item) return;
        const offset = previousTop - child.getBoundingClientRect().top;
        if (offset) {
          child.animate(
            [{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }],
            { duration: 130, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
          );
        }
      });
    }

    function finishOptionDrag(event) {
      if (!activeOptionDrag || event.pointerId !== activeOptionDrag.pointerId) return;
      if (optionDragFrame) {
        cancelAnimationFrame(optionDragFrame);
        optionDragFrame = 0;
        updateOptionDrag();
      }

      const { item, list, fieldIndex, preview, moved, initialOrder } = activeOptionDrag;
      activeOptionDrag = null;
      item.classList.remove("drag-placeholder");
      preview.remove();
      list.querySelectorAll(".drop-before, .drop-after").forEach(target => {
        target.classList.remove("drop-before", "drop-after");
      });

      const orderChanged = moved && initialOrder.some((row, index) => list.children[index] !== row);
      if (orderChanged) {
        fieldOptions[fieldIndex] = Array.from(list.querySelectorAll(".option-item input"), input => input.value);
        renderSettings();
      }
    }

    function updateOptionDrag() {
      optionDragFrame = 0;
      if (!activeOptionDrag) return;

      const { item, list, preview, pointerX, pointerY, offsetX, offsetY } = activeOptionDrag;
      preview.style.transform = `translate3d(${pointerX - offsetX}px, ${pointerY - offsetY}px, 0)`;

      const target = document.elementFromPoint(pointerX, pointerY)?.closest(".option-item");
      list.querySelectorAll(".drop-before, .drop-after").forEach(optionItem => {
        optionItem.classList.remove("drop-before", "drop-after");
      });

      let before = null;
      if (target && target !== item && target.parentElement === list) {
        const rect = target.getBoundingClientRect();
        const insertAfter = pointerY >= rect.top + rect.height / 2;
        target.classList.add(insertAfter ? "drop-after" : "drop-before");
        before = insertAfter ? target.nextElementSibling : target;
      } else if (target === item) {
        return;
      } else {
        const rows = Array.from(list.children).filter(row => row !== item);
        const lastRow = rows[rows.length - 1];
        if (lastRow && pointerY < lastRow.getBoundingClientRect().bottom) return;
      }

      if (before === item || before === item.nextElementSibling) return;
      moveOptionItem(list, item, before);
      activeOptionDrag.moved = true;
    }

    document.addEventListener("pointermove", event => {
      if (!activeOptionDrag || event.pointerId !== activeOptionDrag.pointerId) return;
      activeOptionDrag.pointerX = event.clientX;
      activeOptionDrag.pointerY = event.clientY;
      if (!optionDragFrame) optionDragFrame = requestAnimationFrame(updateOptionDrag);
    });

    document.addEventListener("pointerup", finishOptionDrag);
    document.addEventListener("pointercancel", finishOptionDrag);

    function renderSettings() {
      const settingsContent = document.getElementById("settingsContent");
      settingsContent.innerHTML = "";

      fields.forEach((field, index) => {
        const fieldSettings = document.createElement("div");
        fieldSettings.className = "field-settings";
        const title = document.createElement("div");
        title.className = "field-settings-title";
        title.textContent = field;
        const optionsList = document.createElement("div");
        optionsList.className = "options-list";
        optionsList.id = `options-${index}`;

        fieldOptions[index].forEach((option, optIndex) => {
          const optionItem = document.createElement("div");
          optionItem.className = "option-item";

          const dragHandle = document.createElement("button");
          dragHandle.type = "button";
          dragHandle.className = "drag-handle";
          dragHandle.textContent = "⋮⋮";
          dragHandle.title = "Drag to reorder";
          dragHandle.setAttribute("aria-label", `Drag ${field} option to reorder`);
          dragHandle.addEventListener("pointerdown", event => {
            if (event.button !== 0 || activeOptionDrag) return;
            event.preventDefault();
            const rect = optionItem.getBoundingClientRect();
            const preview = optionItem.cloneNode(true);
            preview.classList.add("option-item-drag-preview");
            preview.setAttribute("aria-hidden", "true");
            preview.style.width = `${rect.width}px`;
            preview.style.left = `${rect.left}px`;
            preview.style.top = `${rect.top}px`;
            document.body.appendChild(preview);
            activeOptionDrag = {
              fieldIndex: index,
              item: optionItem,
              list: optionsList,
              initialOrder: Array.from(optionsList.children),
              moved: false,
              offsetX: event.clientX - rect.left,
              offsetY: event.clientY - rect.top,
              pointerId: event.pointerId,
              pointerX: event.clientX,
              pointerY: event.clientY,
              preview
            };
            preview.style.transformOrigin = `${activeOptionDrag.offsetX}px ${activeOptionDrag.offsetY}px`;
            optionItem.classList.add("drag-placeholder");
            dragHandle.setPointerCapture(event.pointerId);
          });

          const optionInput = document.createElement("input");
          optionInput.type = "text";
          optionInput.value = option;
          optionInput.setAttribute("aria-label", `${field} option ${optIndex + 1}`);
          optionInput.addEventListener("input", () => {
            fieldOptions[index][optIndex] = optionInput.value;
          });

          const removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.className = "remove-option-btn";
          removeButton.textContent = "Remove";
          removeButton.addEventListener("click", () => removeOption(index, optIndex));

          optionItem.append(dragHandle, optionInput, removeButton);
          optionsList.appendChild(optionItem);
        });

        const addInput = document.createElement("input");
        addInput.type = "text";
        addInput.placeholder = "New option...";
        addInput.className = "add-option-input";
        addInput.id = `newOption-${index}`;
        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "add-option-btn";
        addButton.id = `addBtn-${index}`;
        addButton.textContent = "+ Add Option";
        addButton.addEventListener("click", () => addOption(index));

        fieldSettings.append(title, optionsList, addInput, addButton);
        settingsContent.appendChild(fieldSettings);
      });
    }

    function addOption(index) {
      const input = document.getElementById(`newOption-${index}`);
      const newOption = input.value.trim();
      if (newOption) {
        fieldOptions[index].push(newOption);
        input.value = "";
        renderSettings();
        document.getElementById(`newOption-${index}`).focus();
      }
    }

    function removeOption(index, optIndex) {
      fieldOptions[index].splice(optIndex, 1);
      renderSettings();
    }

    window.addOption = addOption;
    window.removeOption = removeOption;

    document.getElementById("settingsToggle").addEventListener("click", () => {
      document.getElementById("settingsSidebar").classList.toggle("show");
      if (document.getElementById("settingsSidebar").classList.contains("show")) {
        renderSettings();
      }
    });

    document.getElementById("settingsClose").addEventListener("click", () => {
      document.getElementById("settingsSidebar").classList.remove("show");
    });

    document.getElementById("saveSettings").addEventListener("click", () => {
      localStorage.setItem("field-options", JSON.stringify(fieldOptions));
      regenerateAllDropdowns();
      inputs.forEach((input, index) => {
        updateSuggestion(input, index, input.parentElement.querySelector(".field-suggestion"));
      });
      showCustomAlert("Settings saved!");
      document.getElementById("settingsSidebar").classList.remove("show");
    });

    document.getElementById("exportSettings").addEventListener("click", () => {
      const file = new Blob([`${JSON.stringify(fieldOptions, null, 2)}\n`], {
        type: "application/json"
      });
      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "dropdown-options.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      showCustomAlert("Dropdown options exported.");
    });

    function isValidOptionSet(options) {
      return options !== null &&
        typeof options === "object" &&
        !Array.isArray(options) &&
        Array.from({ length: fields.length }, (_, index) =>
          Array.isArray(options[index]) &&
          options[index].every(option => typeof option === "string")
        ).every(Boolean);
    }

    function setImportStatus(message, isError = false) {
      importStatus.textContent = message;
      importStatus.classList.toggle("is-error", isError);
    }

    async function importOptionsFile(file) {
      if (!file) return;

      try {
        const importedOptions = JSON.parse(await file.text());
        if (!isValidOptionSet(importedOptions)) {
          throw new Error("This file is missing dropdown options or has an invalid format. Choose an options file exported from this app.");
        }

        if (!window.confirm("Replace the dropdown options on this device with the options from this file?")) {
          setImportStatus("Import cancelled. Your current options are unchanged.");
          return;
        }

        const nextOptions = cloneOptions(
          Object.fromEntries(fields.map((_, index) => [index, importedOptions[index]]))
        );
        localStorage.setItem("field-options", JSON.stringify(nextOptions));
        fieldOptions = nextOptions;
        regenerateAllDropdowns();
        renderSettings();
        inputs.forEach((input, index) => {
          updateSuggestion(input, index, input.parentElement.querySelector(".field-suggestion"));
        });
        setImportStatus(`${file.name} is ready. These options are now saved in this browser.`);
      } catch (error) {
        console.error("Could not import dropdown options.", error);
        setImportStatus(error instanceof SyntaxError
          ? "This file could not be read. Choose a valid options JSON file."
          : error.message || "The options could not be imported. Please try again.", true);
      } finally {
        importFileInput.value = "";
      }
    }

    importFileInput.addEventListener("change", () => {
      importOptionsFile(importFileInput.files[0]);
    });

    ["dragenter", "dragover"].forEach(eventName => {
      importZone.addEventListener(eventName, event => {
        event.preventDefault();
        event.stopPropagation();
        importZone.classList.add("is-drag-over");
      });
    });

    ["dragleave", "drop"].forEach(eventName => {
      importZone.addEventListener(eventName, event => {
        event.preventDefault();
        event.stopPropagation();
        if (eventName === "dragleave" && event.relatedTarget && importZone.contains(event.relatedTarget)) return;
        importZone.classList.remove("is-drag-over");
      });
    });

    importZone.addEventListener("drop", event => {
      importOptionsFile(event.dataTransfer.files[0]);
    });

    // Regenerate dropdown menus after settings change
    function regenerateAllDropdowns() {
      inputs.forEach((input, index) => {
        const wrapper = input.parentElement;
        const oldMenu = wrapper.querySelector(".field-dropdown-menu");
        if (oldMenu) oldMenu.remove();

        wrapper.querySelector(".field-dropdown-btn").setAttribute("aria-expanded", "false");
        const dropdownMenu = createDropdownMenu(input, index);
        wrapper.appendChild(dropdownMenu);
      });
    }

    // Close sidebars when clicking outside
    document.addEventListener("click", (e) => {
      const settingsSidebar = document.getElementById("settingsSidebar");
      const commentsSidebar = document.getElementById("commentsSidebar");
      const settingsToggle = document.getElementById("settingsToggle");
      const commentsToggle = document.getElementById("commentsToggle");
      const eventPath = e.composedPath();
      const clickedInsideSettings = settingsSidebar.contains(e.target) || eventPath.includes(settingsSidebar);

      // Only close if clicking outside the sidebar and not on the toggle button
      if (settingsSidebar.classList.contains("show") && !clickedInsideSettings && e.target !== settingsToggle && !settingsToggle.contains(e.target)) {
        settingsSidebar.classList.remove("show");
      }

      if (commentsSidebar.classList.contains("show") && !commentsSidebar.contains(e.target) && e.target !== commentsToggle && !commentsToggle.contains(e.target)) {
        commentsSidebar.classList.remove("show");
      }

      // Close all open dropdowns when clicking outside
      if (!e.target.classList.contains("field-dropdown-btn")) {
        closeDropdowns();
      }
    });

    // Draggable Sticky Notes
    const stickyNotes = document.querySelector(".sticky-notes");
    const stickyTitle = document.querySelector(".sticky-notes-title");
    const stickyResetBtn = document.querySelector(".sticky-notes-reset");
    const stickyHideBtn = document.querySelector(".sticky-notes-hide");
    const quickNotesToggle = document.getElementById("showQuickNotes");
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function setQuickNotesVisible(isVisible) {
      stickyNotes.classList.toggle("is-hidden", !isVisible);
      quickNotesToggle.setAttribute("aria-pressed", String(isVisible));
      quickNotesToggle.title = isVisible ? "Hide Quick Notes" : "Show Quick Notes";
      quickNotesToggle.setAttribute("aria-label", quickNotesToggle.title);
      localStorage.setItem("quick-notes-hidden", String(!isVisible));
    }

    setQuickNotesVisible(localStorage.getItem("quick-notes-hidden") !== "true");
    quickNotesToggle.addEventListener("click", () => {
      setQuickNotesVisible(stickyNotes.classList.contains("is-hidden"));
    });
    stickyHideBtn.addEventListener("click", event => {
      event.stopPropagation();
      setQuickNotesVisible(false);
    });

    if (stickyTitle && stickyNotes) {
      stickyTitle.addEventListener("mousedown", (e) => {
        // Don't drag if clicking the reset button
        if (e.target.closest(".sticky-notes-actions")) return;
        isDragging = true;
        const rect = stickyNotes.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        stickyNotes.style.cursor = "grabbing";
      });

      document.addEventListener("mousemove", (e) => {
        if (isDragging) {
          const navHeight = document.querySelector('.navbar')?.offsetHeight || 0;
          const minTop = navHeight + 8;
          const maxLeft = window.innerWidth - stickyNotes.offsetWidth - 8;
          const maxTop = window.innerHeight - stickyNotes.offsetHeight - 8;

          let newLeft = e.clientX - offsetX;
          let newTop = e.clientY - offsetY;

          newLeft = Math.min(Math.max(8, newLeft), maxLeft);
          newTop = Math.min(Math.max(minTop, newTop), maxTop);

          stickyNotes.style.left = newLeft + "px";
          stickyNotes.style.top = newTop + "px";
          stickyNotes.style.bottom = "auto";
        }
      });

      document.addEventListener("mouseup", () => {
        isDragging = false;
        stickyNotes.style.cursor = "default";
      });
    }

    // Reset sticky notes position
    if (stickyResetBtn) {
      stickyResetBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        stickyNotes.style.bottom = "20px";
        stickyNotes.style.left = "20px";
        stickyNotes.style.top = "auto";
        stickyNotes.style.right = "auto";
      });
    }
