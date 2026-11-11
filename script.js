// DAILY JOURNAL

const KEYS = {
    entries: "dj_entries",
    draft: "dj_draft",
    theme: "dj_theme"
};

const MOODS = ["Great", "Good", "Okay", "Low", "Awful"];
const MAX = 1000;

const state = {
    entries: {},
    mood: null,
    editDate: null,
    sort: "newest"
};

const $ = id => document.getElementById(id);


// 1. HELPER FUNCTIONS


function todayKey() {
    const d = new Date();

    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

function prettyDate(date) {
    return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function loadStore(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
        return fallback;
    }
}

function saveStore(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        toast("Could not save. Browser storage is unavailable.", "error");
        return false;
    }
}

function makeElement(tag, className = "", text = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}

let toastTimer;

function toast(message, type = "") {
    const box = $("toast");

    box.textContent = message;
    box.className = "show " + type;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        box.className = "";
    }, 2500);
}

function confirmAction(message) {
    return new Promise(resolve => {
        const box = $("confirmBox");

        $("confirmText").textContent = message;

        box.addEventListener("close", () => {
            resolve(box.returnValue === "yes");
        }, { once: true });

        box.showModal();
    });
}


// ==============================
// 2. NAVIGATION
// ==============================

function showSection(id) {
    document.querySelectorAll("main > section").forEach(section => {
        section.hidden = section.id !== id;
    });

    document.querySelectorAll("#nav button").forEach(button => {
        button.classList.toggle("active", button.dataset.section === id);
    });

    if (id === "history") applyFilters();
    if (id === "summary") renderSummary();
}


// ==============================
// 3. MOOD PICKER
// ==============================

function buildMoodButtons() {

    MOODS.forEach(mood => {
        const button = makeElement("button", "", mood);

        button.type = "button";
        button.dataset.mood = mood;

        $("moodPicker").appendChild(button);
    });

    const option = makeElement("option", "", "All moods");
    option.value = "";

    $("moodFilter").appendChild(option);

    MOODS.forEach(mood => {
        const option = makeElement("option", "", mood);

        option.value = mood;

        $("moodFilter").appendChild(option);
    });
}

function selectMood(mood) {
    state.mood = mood;

    document.querySelectorAll("#moodPicker button").forEach(button => {
        button.classList.toggle("selected", button.dataset.mood === mood);
    });

    setMsg("moodMsg", "");
    saveDraft();
}


// ==============================
// 4. FORM VALIDATION
// ==============================

function setMsg(id, message, success = false) {
    const element = $(id);

    element.textContent = message;
    element.className = success ? "msg ok" : "msg";
}

function updateCharCount() {
    const length = $("body").value.length;

    $("count").textContent = length + " / " + MAX;

    $("count").classList.toggle("warn", length > MAX * 0.9);
}

function validateField(field) {
    const value = field.value.trim();
    let error = "";

    if (field.id === "title") {
        if (!value) {
            error = "Add a title.";
        } else if (value.length > 60) {
            error = "Title must be 60 characters or fewer.";
        }
    }

    if (field.id === "body") {
        if (!value) {
            error = "Write something about your day.";
        } else if (value.length < 10) {
            error = "Write at least 10 characters.";
        } else if (field.value.length > MAX) {
            error = "Entry is over " + MAX + " characters.";
        }
    }

    field.classList.toggle("bad", Boolean(error));
    field.classList.toggle("good", !error);

    setMsg(field.id + "Msg", error || "Looks good.", !error);

    return !error;
}


// ==============================
// 5. SAVE DRAFT
// ==============================

function saveDraft() {
    if (state.editDate) return;

    saveStore(KEYS.draft, {
        title: $("title").value,
        body: $("body").value,
        mood: state.mood
    });
}


// ==============================
// 6. RESET FORM
// ==============================

function resetForm() {
    state.editDate = null;
    state.mood = null;

    $("title").value = "";
    $("body").value = "";

    ["title", "body"].forEach(id => {
        $(id).className = "";
        setMsg(id + "Msg", "");
    });

    setMsg("moodMsg", "");

    document.querySelectorAll("#moodPicker button").forEach(button => {
        button.classList.remove("selected");
    });

    $("formTitle").textContent = "Write today's entry";
    $("saveBtn").textContent = "Save Entry";
    $("cancelBtn").hidden = true;

    updateCharCount();
}

function prepareTodayForm() {
    resetForm();

    const today = todayKey();

    if (state.entries[today]) {
        loadEntryForEdit(today, false);
        return;
    }

    const draft = loadStore(KEYS.draft, null);

    if (draft) {
        $("title").value = draft.title || "";
        $("body").value = draft.body || "";

        if (MOODS.includes(draft.mood)) {
            selectMood(draft.mood);
        }

        updateCharCount();
    }
}


// ==============================
// 7. SAVE JOURNAL ENTRY
// ==============================

function handleSaveEntry(event) {
    event.preventDefault();

    const validTitle = validateField($("title"));
    const validBody = validateField($("body"));

    if (!state.mood) {
        setMsg("moodMsg", "Pick a mood.");
    }

    if (!validTitle || !validBody || !state.mood) {
        toast("Fix the highlighted fields.", "error");
        return;
    }

    const date = state.editDate || todayKey();

    const entry = {
        date: date,
        mood: state.mood,
        title: $("title").value.trim(),
        body: $("body").value.trim(),
        updated: Date.now()
    };

    const isUpdate = Boolean(state.entries[date]);

    const updatedEntries = {
        ...state.entries,
        [date]: entry
    };

    if (!saveStore(KEYS.entries, updatedEntries)) return;

    state.entries = updatedEntries;

    if (date === todayKey()) {
        try {
            localStorage.removeItem(KEYS.draft);
        } catch {}
    }

    toast(isUpdate ? "Entry updated." : "Entry saved.");

    prepareTodayForm();
    applyFilters();
    renderSummary();
}


// ==============================
// 8. HISTORY AND SEARCH
// ==============================

function sortEntries(order) {
    state.sort = order;
    applyFilters();
}

function applyFilters() {
    const search = $("search").value.trim().toLowerCase();
    const mood = $("moodFilter").value;
    const from = $("dateFrom").value;
    const to = $("dateTo").value;

    let entries = Object.values(state.entries).filter(entry => {

        const matchesSearch =
            !search ||
            entry.title.toLowerCase().includes(search) ||
            entry.body.toLowerCase().includes(search);

        const matchesMood = !mood || entry.mood === mood;
        const matchesFrom = !from || entry.date >= from;
        const matchesTo = !to || entry.date <= to;

        return matchesSearch && matchesMood && matchesFrom && matchesTo;
    });

    entries.sort((a, b) => {
        return state.sort === "newest"
            ? b.date.localeCompare(a.date)
            : a.date.localeCompare(b.date);
    });

    renderHistory(entries);
}


// ==============================
// 9. DISPLAY HISTORY
// ==============================

function renderHistory(entries) {
    const list = $("entryList");

    list.innerHTML = "";

    const total = Object.keys(state.entries).length;

    if (total === 0) {
        $("resultInfo").textContent =
            "No entries yet. Write your first one in Today.";
    } else if (entries.length === 0) {
        $("resultInfo").textContent =
            "No entries match your filters.";
    } else {
        $("resultInfo").textContent =
            "Showing " + entries.length + " of " + total + " entries.";
    }

    entries.forEach(entry => {

        const item = makeElement("li");
        item.dataset.mood = entry.mood;

        item.appendChild(makeElement("span", "dot"));

        const info = makeElement("div");

        info.appendChild(
            makeElement("strong", "", entry.title)
        );

        info.appendChild(
            makeElement("small", "", prettyDate(entry.date) + " - " + entry.mood)
        );

        const buttons = makeElement("div", "row");

        const actions = [
            ["View", () => showEntryDetail(entry.date), "ghost"],
            ["Edit", () => loadEntryForEdit(entry.date, true), "ghost"],
            ["Delete", () => deleteEntry(entry.date), "danger"]
        ];

        actions.forEach(([label, action, className]) => {

            const button = makeElement("button", className, label);

            button.type = "button";
            button.addEventListener("click", action);

            buttons.appendChild(button);
        });

        item.append(info, buttons);

        list.appendChild(item);
    });

    $("detail").hidden = true;
}


// ==============================
// 10. VIEW ENTRY
// ==============================

function showEntryDetail(date) {
    const entry = state.entries[date];

    if (!entry) return;

    const detail = $("detail");

    detail.innerHTML = "";
    detail.hidden = false;
    detail.dataset.mood = entry.mood;

    detail.append(
        makeElement("h3", "", entry.title),
        makeElement("p", "muted", prettyDate(entry.date) + " - " + entry.mood),
        makeElement("p", "", entry.body)
    );
}


// ==============================
// 11. EDIT ENTRY
// ==============================

function loadEntryForEdit(date, switchTab) {
    const entry = state.entries[date];

    if (!entry) return;

    state.editDate = date;

    $("title").value = entry.title;
    $("body").value = entry.body;

    selectMood(entry.mood);

    $("formTitle").textContent =
        date === todayKey()
            ? "Today's entry"
            : "Editing " + prettyDate(date);

    $("saveBtn").textContent = "Update Entry";
    $("cancelBtn").hidden = date === todayKey();

    updateCharCount();

    if (switchTab) {
        showSection("today");
    }
}


// ==============================
// 12. DELETE ENTRY
// ==============================

async function deleteEntry(date) {
    if (!state.entries[date]) return;

    const confirmed = await confirmAction(
        "Delete the entry from " + prettyDate(date) +
        "? This cannot be undone."
    );

    if (!confirmed) return;

    const updatedEntries = { ...state.entries };

    delete updatedEntries[date];

    if (!saveStore(KEYS.entries, updatedEntries)) return;

    state.entries = updatedEntries;

    if (state.editDate === date) {
        prepareTodayForm();
    }

    applyFilters();
    renderSummary();

    toast("Entry deleted.");
}


// ==============================
// 13. SUMMARY AND STATISTICS
// ==============================

function computeStreak() {
    const date = new Date();

    if (!state.entries[todayKey()]) {
        date.setDate(date.getDate() - 1);
    }

    let streak = 0;

    function dateKey(d) {
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    while (state.entries[dateKey(date)]) {
        streak++;
        date.setDate(date.getDate() - 1);
    }

    return streak;
}

function renderSummary() {
    const entries = Object.values(state.entries);
    const counts = {};

    MOODS.forEach(mood => {
        counts[mood] = entries.filter(entry => entry.mood === mood).length;
    });

    const month = todayKey().slice(0, 7);

    const topMood = MOODS.reduce((best, mood) => {
        return counts[mood] > counts[best] ? mood : best;
    }, MOODS[0]);

    $("statStreak").textContent = computeStreak();

    $("statMonth").textContent =
        entries.filter(entry => entry.date.startsWith(month)).length;

    $("statTop").textContent = entries.length ? topMood : "-";

    const bars = $("bars");

    bars.innerHTML = "";

    const max = Math.max(1, ...Object.values(counts));

    MOODS.forEach(mood => {

        const row = makeElement("div", "bar");
        row.dataset.mood = mood;

        const bar = makeElement("i");

        bar.style.width = (counts[mood] / max * 100) + "%";

        row.append(
            makeElement("span", "", mood),
            bar,
            makeElement("span", "", counts[mood])
        );

        bars.appendChild(row);
    });
}


// ==============================
// 14. EXPORT BACKUP
// ==============================

function exportData() {
    if (!Object.keys(state.entries).length) {
        setMsg("backupMsg", "Nothing to export yet.");
        return;
    }

    const backup = {
        app: "daily-journal",
        entries: state.entries
    };

    const file = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
    );

    const link = makeElement("a");

    link.href = URL.createObjectURL(file);
    link.download = "daily-journal-" + todayKey() + ".json";

    link.click();

    URL.revokeObjectURL(link.href);

    setMsg("backupMsg", "Backup downloaded.", true);
}


// ==============================
// 15. IMPORT BACKUP
// ==============================

function validateImport(data) {
    const source = data && data.entries ? data.entries : data;

    if (!source || typeof source !== "object" || Array.isArray(source)) {
        throw new Error("File is not a journal backup.");
    }

    const result = {};

    for (const [date, entry] of Object.entries(source)) {

        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);

        const validMood = entry && MOODS.includes(entry.mood);

        const validText = entry &&
            typeof entry.title === "string" &&
            typeof entry.body === "string" &&
            entry.title.trim() &&
            entry.body.length <= MAX;

        if (!validDate || !validMood || !validText) {
            throw new Error('Invalid entry found at "' + date + '".');
        }

        result[date] = {
            date: date,
            mood: entry.mood,
            title: entry.title.trim(),
            body: entry.body.trim(),
            updated: entry.updated || Date.now()
        };
    }

    return result;
}

function importData(event) {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {

        try {
            const incoming = validateImport(JSON.parse(reader.result));

            const updatedEntries = {
                ...state.entries,
                ...incoming
            };

            if (!saveStore(KEYS.entries, updatedEntries)) return;

            state.entries = updatedEntries;

            prepareTodayForm();
            applyFilters();
            renderSummary();

            setMsg(
                "backupMsg",
                "Imported " + Object.keys(incoming).length + " entries.",
                true
            );

        } catch (error) {

            setMsg(
                "backupMsg",
                "Import failed: " + error.message +
                " Your existing data was not changed."
            );
        }

        event.target.value = "";
    };

    reader.onerror = () => {
        setMsg("backupMsg", "Could not read the file.");
    };

    reader.readAsText(file);
}


// ==============================
// 16. CLEAR ALL DATA
// ==============================

async function clearAll() {
    const confirmed = await confirmAction(
        "Delete ALL entries and your draft? Export a backup first if unsure."
    );

    if (!confirmed) return;

    try {
        localStorage.removeItem(KEYS.entries);
        localStorage.removeItem(KEYS.draft);
    } catch {}

    state.entries = {};

    prepareTodayForm();
    applyFilters();
    renderSummary();

    setMsg("backupMsg", "All data cleared.", true);
}


// ==============================
// 17. DARK AND LIGHT MODE
// ==============================

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;

    $("themeBtn").textContent =
        theme === "dark" ? "Light mode" : "Dark mode";
}

function toggleTheme() {
    const theme =
        document.documentElement.dataset.theme === "dark"
            ? "light"
            : "dark";

    applyTheme(theme);

    saveStore(KEYS.theme, theme);
}


// ==============================
// 18. INITIALIZE THE APP
// ==============================

function init() {

    const savedEntries = loadStore(KEYS.entries, {});

    state.entries =
        savedEntries && typeof savedEntries === "object" &&
        !Array.isArray(savedEntries)
            ? savedEntries
            : {};

    applyTheme(loadStore(KEYS.theme, "light"));

    $("todayLabel").textContent = prettyDate(todayKey());

    buildMoodButtons();
    prepareTodayForm();
    renderSummary();


    // Navigation
    document.querySelectorAll("#nav button").forEach(button => {
        button.addEventListener("click", () => {
            showSection(button.dataset.section);
        });
    });


    // Mood picker
    $("moodPicker").addEventListener("click", event => {
        const button = event.target.closest("button");

        if (button) {
            selectMood(button.dataset.mood);
        }
    });


    // Form events
    $("body").addEventListener("input", updateCharCount);

    ["title", "body"].forEach(id => {

        $(id).addEventListener("input", saveDraft);

        $(id).addEventListener("blur", event => {
            validateField(event.target);
        });
    });

    $("entryForm").addEventListener("submit", handleSaveEntry);


    // Cancel editing
    $("cancelBtn").addEventListener("click", () => {
        prepareTodayForm();
        toast("Edit cancelled.");
    });


    // Search and filters
    $("search").addEventListener("input", applyFilters);

    ["moodFilter", "dateFrom", "dateTo"].forEach(id => {
        $(id).addEventListener("change", applyFilters);
    });

    $("sortOrder").addEventListener("change", event => {
        sortEntries(event.target.value);
    });


    // Backup and settings
    $("exportBtn").addEventListener("click", exportData);
    $("importFile").addEventListener("change", importData);
    $("clearBtn").addEventListener("click", clearAll);
    $("themeBtn").addEventListener("click", toggleTheme);
}


// START THE PROGRAM

document.addEventListener("DOMContentLoaded", init);