/**
 * Tally Counter application state.
 *
 * Rules:
 * - A minimum of one counter always exists.
 * - A maximum of three counters can be created and pinned as active.
 * - The active counter is the one displayed and edited in the main section.
 */
const MAX_COUNTERS = 3;
const DEFAULT_TALLIES_PER_GROUP = 5;
const MIN_TALLIES_PER_GROUP = 2;
const MAX_TALLIES_PER_GROUP = 10;
const GROUP_ANIMATION_DURATION_MS = 360;
const GROUP_ANIMATION_STAGGER_MS = 40;
const CONTAINER_HEIGHT_ANIMATION_MS = 280;
const STORAGE_NOTICE_DISMISS_MS = 220;
const SETTINGS_PANEL_ANIMATION_MS = 220;
const APP_STATE_STORAGE_KEY = "tallyCounter.appState.v1";
const STORAGE_NOTICE_ACK_KEY = "tallyCounter.storageNoticeAck.v1";

let isGroupTransitionInProgress = false;

const appState = {
    counters: [
        {
            id: 1,
            name: "Counter 1",
            count: 0,
        },
    ],
    activeCounterId: 1,
    nextCounterId: 2,
    settings: {
        theme: "dark",
        talliesPerGroup: DEFAULT_TALLIES_PER_GROUP,
        language: "en",
    },
};

const dom = {
    settingsToggleButton: document.getElementById("settingsToggleButton"),
    settingsPanel: document.getElementById("settingsPanel"),
    themeSliderInput: document.getElementById("themeSliderInput"),
    groupSizeInput: document.getElementById("groupSizeInput"),
    groupSizeValue: document.getElementById("groupSizeValue"),
    languageSelect: document.getElementById("languageSelect"),
    activeCounterName: document.getElementById("activeCounterName"),
    activeCounterValue: document.getElementById("activeCounterValue"),
    activeTallyList: document.getElementById("activeTallyList"),
    countersList: document.getElementById("countersList"),
    bulkAmountInput: document.getElementById("bulkAmountInput"),
    addOneButton: document.getElementById("addOneButton"),
    deleteOneButton: document.getElementById("deleteOneButton"),
    addBulkButton: document.getElementById("addBulkButton"),
    deleteBulkButton: document.getElementById("deleteBulkButton"),
    createCounterButton: document.getElementById("createCounterButton"),
    storageNotice: document.getElementById("storageNotice"),
    acknowledgeStorageButton: document.getElementById("acknowledgeStorageButton"),
};

/**
 * Sanitizes and normalizes tally group size from any source.
 * @param {unknown} rawValue
 * @returns {number}
 */
function normalizeTalliesPerGroup(rawValue) {
    const parsed = Number.parseInt(String(rawValue), 10);

    if (Number.isNaN(parsed)) {
        return DEFAULT_TALLIES_PER_GROUP;
    }

    return Math.min(MAX_TALLIES_PER_GROUP, Math.max(MIN_TALLIES_PER_GROUP, parsed));
}

/**
 * Gets current tallies-per-group setting.
 * @returns {number}
 */
function getTalliesPerGroup() {
    return normalizeTalliesPerGroup(appState.settings.talliesPerGroup);
}

/**
 * Validates loaded state and returns a safe normalized value.
 * @param {unknown} parsedState
 * @returns {{counters: {id:number,name:string,count:number}[], activeCounterId:number, nextCounterId:number} | null}
 */
function normalizeLoadedState(parsedState) {
    if (!parsedState || typeof parsedState !== "object") {
        return null;
    }

    const maybeCounters = parsedState.counters;
    if (!Array.isArray(maybeCounters) || maybeCounters.length === 0) {
        return null;
    }

    const normalizedCounters = maybeCounters
        .slice(0, MAX_COUNTERS)
        .map((counter, index) => {
            const safeId = Number.isInteger(counter?.id) && counter.id > 0 ? counter.id : index + 1;
            const safeName = typeof counter?.name === "string" && counter.name.trim() ? counter.name : `Counter ${safeId}`;
            const rawCount = Number(counter?.count);
            const safeCount = Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 0;

            return {
                id: safeId,
                name: safeName,
                count: safeCount,
            };
        });

    const availableIds = normalizedCounters.map((counter) => counter.id);
    const hasActiveCounter = availableIds.includes(parsedState.activeCounterId);
    const activeCounterId = hasActiveCounter ? parsedState.activeCounterId : normalizedCounters[0].id;

    const maxExistingId = Math.max(...availableIds);
    const nextCounterId = Math.max(maxExistingId + 1, Number(parsedState.nextCounterId) || 2);
    const settings = {
        theme: parsedState?.settings?.theme === "light" ? "light" : "dark",
        talliesPerGroup: normalizeTalliesPerGroup(parsedState?.settings?.talliesPerGroup),
        language: parsedState?.settings?.language === "es" ? "es" : "en",
    };

    return {
        counters: normalizedCounters,
        activeCounterId,
        nextCounterId,
        settings,
    };
}

/**
 * Loads persisted app state from localStorage.
 */
function loadPersistedState() {
    try {
        const rawValue = window.localStorage.getItem(APP_STATE_STORAGE_KEY);

        if (!rawValue) {
            return;
        }

        const parsedState = JSON.parse(rawValue);
        const normalizedState = normalizeLoadedState(parsedState);

        if (!normalizedState) {
            return;
        }

        appState.counters = normalizedState.counters;
        appState.activeCounterId = normalizedState.activeCounterId;
        appState.nextCounterId = normalizedState.nextCounterId;
        appState.settings = normalizedState.settings;
    } catch (error) {
        return;
    }
}

/**
 * Persists app state to localStorage.
 */
function persistState() {
    try {
        window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(appState));
    } catch (error) {
        return;
    }
}

/**
 * Displays a transparency notice for local storage usage.
 */
function renderStorageNotice() {
    if (!dom.storageNotice) {
        return;
    }

    const wasAcknowledged = window.localStorage.getItem(STORAGE_NOTICE_ACK_KEY) === "yes";
    dom.storageNotice.hidden = wasAcknowledged;
}

/**
 * Dismisses and removes the storage notice from the current view.
 */
function dismissStorageNotice() {
    if (!dom.storageNotice) {
        return;
    }

    dom.storageNotice.classList.add("notice-dismiss");

    window.setTimeout(() => {
        dom.storageNotice.hidden = true;
        dom.storageNotice.remove();
    }, STORAGE_NOTICE_DISMISS_MS);
}

/**
 * Applies the current app theme to the document.
 */
function applyTheme() {
    document.documentElement.setAttribute("data-theme", appState.settings.theme);

    if (dom.themeSliderInput) {
        dom.themeSliderInput.checked = appState.settings.theme === "light";
    }
}

/**
 * Applies current settings values to controls.
 */
function syncSettingsControls() {
    if (dom.groupSizeInput) {
        dom.groupSizeInput.value = String(getTalliesPerGroup());
    }

    if (dom.groupSizeValue) {
        dom.groupSizeValue.textContent = String(getTalliesPerGroup());
    }

    if (dom.languageSelect) {
        dom.languageSelect.value = appState.settings.language;
    }
}

/**
 * Gets the currently active counter object.
 * @returns {{id:number,name:string,count:number}}
 */
function getActiveCounter() {
    return appState.counters.find((counter) => counter.id === appState.activeCounterId);
}

/**
 * Ensures a safe positive integer for bulk operations.
 * @returns {number}
 */
function getBulkAmount() {
    const parsedValue = Number.parseInt(dom.bulkAmountInput.value, 10);

    if (Number.isNaN(parsedValue) || parsedValue < 1) {
        dom.bulkAmountInput.value = "1";
        return 1;
    }

    return parsedValue;
}

/**
 * Updates the active counter by a signed amount.
 * Counter value never goes below zero.
 *
 * @param {number} amount
 */
function updateActiveCounter(amount) {
    if (isGroupTransitionInProgress) {
        return;
    }

    const activeCounter = getActiveCounter();

    if (!activeCounter) {
        return;
    }

    const previousCount = activeCounter.count;
    const nextCount = Math.max(0, activeCounter.count + amount);

    if (nextCount === previousCount) {
        return;
    }

    const groupTransition = getGroupTransition(previousCount, nextCount);

    if (groupTransition?.type === "remove") {
        const removedGroupsCount = animateGroupRemoval(groupTransition);

        isGroupTransitionInProgress = true;
        const totalDelay = GROUP_ANIMATION_DURATION_MS + Math.max(0, removedGroupsCount - 1) * GROUP_ANIMATION_STAGGER_MS;

        window.setTimeout(() => {
            activeCounter.count = nextCount;
            render({ animateContainer: true });
            isGroupTransitionInProgress = false;
        }, totalDelay);

        return;
    }

    activeCounter.count = nextCount;
    const groupAnimationOptions = groupTransition?.type === "add" ? groupTransition : null;
    render({ groupAnimationOptions, animateContainer: true });
}

/**
 * Returns group transition metadata when tally changes create/remove complete groups.
 * @param {number} previousCount
 * @param {number} newCount
 * @returns {{type:"add"|"remove", groupStartIndex:number} | null}
 */
function getGroupTransition(previousCount, newCount) {
    const talliesPerGroup = getTalliesPerGroup();
    const previousGroupCount = Math.ceil(previousCount / talliesPerGroup);
    const newGroupCount = Math.ceil(newCount / talliesPerGroup);

    if (newGroupCount === previousGroupCount) {
        return null;
    }

    if (newGroupCount > previousGroupCount) {
        return {
            type: "add",
            groupStartIndex: previousGroupCount,
        };
    }

    return {
        type: "remove",
        groupStartIndex: newGroupCount,
    };
}

/**
 * Animates complete groups out before state is reduced.
 * @param {{groupStartIndex:number}} transition
 * @returns {number}
 */
function animateGroupRemoval(transition) {
    const groups = dom.activeTallyList.querySelectorAll(".tally-group");
    let removedGroupsCount = 0;

    groups.forEach((groupElement, groupIndex) => {
        if (groupIndex < transition.groupStartIndex) {
            return;
        }

        groupElement.classList.add("group-exit");
        groupElement.style.animationDelay = `${removedGroupsCount * GROUP_ANIMATION_STAGGER_MS}ms`;
        removedGroupsCount += 1;
    });

    return removedGroupsCount;
}

/**
 * Animates the active tally list height to create smooth expand/shrink transitions.
 * @param {number} fromHeight
 */
function animateTallyContainerHeight(fromHeight) {
    const toHeight = dom.activeTallyList.scrollHeight;

    if (fromHeight === toHeight) {
        return;
    }

    dom.activeTallyList.style.height = `${fromHeight}px`;
    dom.activeTallyList.style.overflow = "hidden";
    dom.activeTallyList.style.transition = `height ${CONTAINER_HEIGHT_ANIMATION_MS}ms ease`;

    requestAnimationFrame(() => {
        dom.activeTallyList.style.height = `${toHeight}px`;
    });

    window.setTimeout(() => {
        dom.activeTallyList.style.height = "";
        dom.activeTallyList.style.overflow = "";
        dom.activeTallyList.style.transition = "";
    }, CONTAINER_HEIGHT_ANIMATION_MS + 40);
}

/**
 * Creates a new counter if the maximum has not been reached.
 */
function createCounter() {
    if (appState.counters.length >= MAX_COUNTERS) {
        return;
    }

    const nextId = appState.nextCounterId;
    appState.counters.push({
        id: nextId,
        name: `Counter ${nextId}`,
        count: 0,
    });

    appState.activeCounterId = nextId;
    appState.nextCounterId += 1;
    render();
}

/**
 * Pins a specific counter as active in the main tally section.
 * @param {number} counterId
 */
function setActiveCounter(counterId) {
    const exists = appState.counters.some((counter) => counter.id === counterId);

    if (!exists) {
        return;
    }

    appState.activeCounterId = counterId;
    render();
}

/**
 * Creates grouped tally markup (groups of five) for the active counter.
 * @param {number} count
 */
function renderTallyGroups(count, animationOptions = null) {
    dom.activeTallyList.innerHTML = "";

    if (count === 0) {
        return;
    }

    const talliesPerGroup = getTalliesPerGroup();
    const groupCount = Math.ceil(count / talliesPerGroup);
    let pendingTallies = count;

    dom.activeTallyList.style.setProperty("--group-size", String(talliesPerGroup));

    for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
        const groupElement = document.createElement("li");
        groupElement.className = "tally-group";

        if (animationOptions && groupIndex >= animationOptions.groupStartIndex) {
            groupElement.classList.add("group-enter");
            groupElement.style.animationDelay = `${(groupIndex - animationOptions.groupStartIndex) * GROUP_ANIMATION_STAGGER_MS}ms`;
        }

        const talliesInThisGroup = Math.min(talliesPerGroup, pendingTallies);

        for (let tallyIndex = 0; tallyIndex < talliesInThisGroup; tallyIndex += 1) {
            const tallyElement = document.createElement("span");
            tallyElement.className = "tally-mark";
            groupElement.appendChild(tallyElement);
        }

        dom.activeTallyList.appendChild(groupElement);
        pendingTallies -= talliesInThisGroup;
    }
}

/**
 * Renders the counters list below the active counter section.
 */
function renderCountersList() {
    dom.countersList.innerHTML = "";

    appState.counters.forEach((counter) => {
        const listItem = document.createElement("li");
        listItem.className = "counter-item";

        const info = document.createElement("div");
        info.className = "counter-info";
        info.textContent = `${counter.name} · ${counter.count}`;

        const pinButton = document.createElement("button");
        pinButton.type = "button";
        pinButton.className = "pin-button";
        pinButton.textContent = counter.id === appState.activeCounterId ? "Pinned" : "Pin as active";
        pinButton.disabled = counter.id === appState.activeCounterId;
        pinButton.addEventListener("click", () => setActiveCounter(counter.id));

        listItem.appendChild(info);
        listItem.appendChild(pinButton);
        dom.countersList.appendChild(listItem);
    });

    dom.createCounterButton.disabled = appState.counters.length >= MAX_COUNTERS;
}

/**
 * Renders the full UI from state.
 */
function render({ groupAnimationOptions = null, animateContainer = false } = {}) {
    const activeCounter = getActiveCounter();

    if (!activeCounter) {
        return;
    }

    const previousContainerHeight = dom.activeTallyList.offsetHeight;

    dom.activeCounterName.textContent = activeCounter.name;
    dom.activeCounterValue.textContent = String(activeCounter.count);

    renderTallyGroups(activeCounter.count, groupAnimationOptions);
    renderCountersList();
    syncSettingsControls();
    applyTheme();

    if (animateContainer) {
        animateTallyContainerHeight(previousContainerHeight);
    }

    persistState();
}

/**
 * Returns whether the settings panel is currently visible.
 * @returns {boolean}
 */
function isSettingsPanelOpen() {
    return Boolean(dom.settingsPanel && !dom.settingsPanel.hidden);
}

/**
 * Opens settings panel with animation.
 */
function openSettingsPanel() {
    if (!dom.settingsPanel || !dom.settingsToggleButton) {
        return;
    }

    if (isSettingsPanelOpen()) {
        return;
    }

    dom.settingsPanel.hidden = false;
    dom.settingsPanel.classList.remove("is-closing");

    requestAnimationFrame(() => {
        dom.settingsPanel.classList.add("is-open");
    });

    dom.settingsToggleButton.setAttribute("aria-expanded", "true");
}

/**
 * Closes settings panel with animation.
 */
function closeSettingsPanel() {
    if (!dom.settingsPanel || !dom.settingsToggleButton) {
        return;
    }

    if (!isSettingsPanelOpen()) {
        return;
    }

    dom.settingsPanel.classList.remove("is-open");
    dom.settingsPanel.classList.add("is-closing");
    dom.settingsToggleButton.setAttribute("aria-expanded", "false");

    window.setTimeout(() => {
        if (!dom.settingsPanel) {
            return;
        }

        dom.settingsPanel.hidden = true;
        dom.settingsPanel.classList.remove("is-closing");
    }, SETTINGS_PANEL_ANIMATION_MS);
}

/**
 * Toggles settings panel visibility.
 */
function toggleSettingsPanel() {
    if (isSettingsPanelOpen()) {
        closeSettingsPanel();
        return;
    }

    openSettingsPanel();
}

/**
 * Closes settings panel when user clicks outside of it.
 * @param {MouseEvent} event
 */
function handleOutsideSettingsClick(event) {
    if (!isSettingsPanelOpen()) {
        return;
    }

    const target = event.target;

    if (!(target instanceof Node)) {
        return;
    }

    const clickedInsidePanel = dom.settingsPanel.contains(target);
    const clickedToggleButton = dom.settingsToggleButton.contains(target);

    if (clickedInsidePanel || clickedToggleButton) {
        return;
    }

    closeSettingsPanel();
}

/**
 * Updates tally-per-group setting while preserving UI stability.
 */
function updateTalliesPerGroupSetting() {
    const nextValue = normalizeTalliesPerGroup(dom.groupSizeInput?.value ?? DEFAULT_TALLIES_PER_GROUP);

    if (nextValue === appState.settings.talliesPerGroup) {
        syncSettingsControls();
        return;
    }

    appState.settings.talliesPerGroup = nextValue;
    render({ animateContainer: true });
}

/**
 * Wires UI events once at startup.
 */
function attachEventListeners() {
    dom.settingsToggleButton.addEventListener("click", toggleSettingsPanel);
    document.addEventListener("click", handleOutsideSettingsClick);

    dom.themeSliderInput.addEventListener("change", () => {
        appState.settings.theme = dom.themeSliderInput.checked ? "light" : "dark";
        applyTheme();
        persistState();
    });

    dom.groupSizeInput.addEventListener("input", updateTalliesPerGroupSetting);

    dom.languageSelect.addEventListener("change", () => {
        appState.settings.language = dom.languageSelect.value === "es" ? "es" : "en";
        persistState();
    });

    dom.addOneButton.addEventListener("click", () => updateActiveCounter(1));
    dom.deleteOneButton.addEventListener("click", () => updateActiveCounter(-1));

    dom.addBulkButton.addEventListener("click", () => {
        updateActiveCounter(getBulkAmount());
    });

    dom.deleteBulkButton.addEventListener("click", () => {
        updateActiveCounter(-getBulkAmount());
    });

    dom.createCounterButton.addEventListener("click", createCounter);

    dom.acknowledgeStorageButton.addEventListener("click", () => {
        window.localStorage.setItem(STORAGE_NOTICE_ACK_KEY, "yes");
        dismissStorageNotice();
    });
}

loadPersistedState();
attachEventListeners();
render({ animateContainer: false });
renderStorageNotice();