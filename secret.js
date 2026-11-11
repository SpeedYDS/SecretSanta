
const SUPABASE_URL = "https://dymdunoliwhekvvgaqhs.supabase.co";
const SUPABASE_KEY = "sb_publishable_36woZbZbqgU7lx-zK95A7A_w4O3Qo8g";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// Элементы страницы
const joinTab = document.getElementById("joinTab");
const createTab = document.getElementById("createTab");
const joinForm = document.getElementById("joinForm");
const createForm = document.getElementById("createForm");
const message = document.getElementById("message");

// Создаём панель комнаты
const roomPanel = document.createElement("div");
roomPanel.id = "roomPanel";
roomPanel.className = "room-panel hidden";

document.querySelector(".auth-card").after(roomPanel);

// Безопасное отображение текста
function safeText(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char];
    });
}

function showMessage(text) {
    message.textContent = text;
}

// Переключение вкладок
joinTab.addEventListener("click", function () {
    joinForm.classList.remove("hidden");
    createForm.classList.add("hidden");

    joinTab.classList.add("active");
    createTab.classList.remove("active");
});

createTab.addEventListener("click", function () {
    createForm.classList.remove("hidden");
    joinForm.classList.add("hidden");

    createTab.classList.add("active");
    joinTab.classList.remove("active");
});

// Отображение комнаты
function renderRoom(room, inviteCodes) {
    roomPanel.classList.remove("hidden");

    let codesHTML = "";

    if (inviteCodes && inviteCodes.length > 0) {
        codesHTML = `
            <h3>Личные коды участников</h3>
            <p>Передай каждому его код лично.</p>
            <div class="invite-list">
                ${inviteCodes.map(function (person) {
                    return `
                        <div class="invite-item">
                            <strong>${safeText(person.name)}</strong>
                            <code>${safeText(person.code)}</code>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }

    const isAdmin = Boolean(
        localStorage.getItem("ss_admin_token")
    );

    roomPanel.innerHTML = `
        <h2>Твоя комната</h2>

        <div class="room-code-box">
            <span>Код комнаты</span>
            <strong>${safeText(room.room_code)}</strong>
        </div>

        <p>Участники: ${room.joined || 1} / 10</p>

        <div class="participant-list">
            ${(room.participants || []).map(function (name) {
                return `<div>🎁 ${safeText(name)}</div>`;
            }).join("")}
        </div>

        ${codesHTML}

        <div class="room-actions">
            <button id="refreshButton" class="main-button">
                Обновить участников
            </button>

            <button id="resultButton" class="main-button">
                Мой результат
            </button>

            ${isAdmin ? `
                <button id="drawButton" class="draw-button">
                    Провести жеребьёвку
                </button>
            ` : ""}
        </div>

        <p id="roomMessage"></p>
    `;

    document.getElementById("refreshButton")
        .addEventListener("click", refreshRoom);

    document.getElementById("resultButton")
        .addEventListener("click", showMyResult);

    if (isAdmin) {
        document.getElementById("drawButton")
            .addEventListener("click", drawNames);
    }
}

// Обновление комнаты
async function refreshRoom() {
    const roomCode = localStorage.getItem("ss_room_code");
    const accessToken = localStorage.getItem("ss_access_token");
    const adminToken = localStorage.getItem("ss_admin_token");

    const { data, error } = await supabaseClient.rpc(
        "ss_room_info",
        {
            p_code: roomCode,
            p_access_token: accessToken,
            p_admin_token: adminToken
        }
    );

    if (error) {
        showMessage(error.message);
        return;
    }

    renderRoom(data, []);
}

// Создание комнаты
document.getElementById("createButton")
    .addEventListener("click", async function () {

        const hostName = document.getElementById("hostName").value.trim();
        const setupCode = document.getElementById("setupCode").value;
        const budget = document.getElementById("budget").value.trim();
        const eventDate = document.getElementById("eventDate").value;

        if (!hostName || !setupCode) {
            showMessage("Заполни имя и секретный код.");
            return;
        }

        const { data, error } = await supabaseClient.rpc(
            "ss_create_room",
            {
                p_host_name: hostName,
                p_setup_code: setupCode,
                p_budget: budget || null,
                p_event_date: eventDate || null
            }
        );

        if (error) {
            showMessage(error.message);
            return;
        }

        localStorage.setItem("ss_admin_token", data.admin_token);
        localStorage.setItem("ss_access_token", data.host_token);
        localStorage.setItem("ss_room_code", data.room_code);

        showMessage("Комната успешно создана!");

        const { data: room, error: roomError } =
            await supabaseClient.rpc("ss_room_info", {
                p_code: data.room_code,
                p_access_token: data.host_token,
                p_admin_token: data.admin_token
            });

        if (roomError) {
            showMessage(roomError.message);
            return;
        }

        renderRoom(room, data.invite_codes);
    });

// Вход участника
document.getElementById("joinButton")
    .addEventListener("click", async function () {

        const roomCode = document.getElementById("roomCode").value.trim();
        const name = document.getElementById("participantName").value.trim();
        const inviteCode = document.getElementById("inviteCode").value.trim();

        if (!roomCode || !name || !inviteCode) {
            showMessage("Заполни все поля.");
            return;
        }

        const { data, error } = await supabaseClient.rpc(
            "ss_join_room",
            {
                p_code: roomCode,
                p_name: name,
                p_invite_code: inviteCode
            }
        );

        if (error) {
            showMessage(error.message);
            return;
        }

        localStorage.setItem("ss_access_token", data.access_token);
        localStorage.setItem("ss_room_code", roomCode);

        showMessage("Добро пожаловать, " + data.name + "!");

        await refreshRoom();
    });

// Проведение жеребьёвки
async function drawNames() {
    const roomCode = localStorage.getItem("ss_room_code");
    const adminToken = localStorage.getItem("ss_admin_token");

    if (!confirm("Провести жеребьёвку? Отменить её будет нельзя.")) {
        return;
    }

    const { data, error } = await supabaseClient.rpc(
        "ss_draw",
        {
            p_code: roomCode,
            p_admin_token: adminToken
        }
    );

    if (error) {
        document.getElementById("roomMessage").textContent =
            error.message;
        return;
    }

    document.getElementById("roomMessage").textContent =
        "Жеребьёвка успешно проведена! 🎉";

    await refreshRoom();
}

// Личный результат
async function showMyResult() {
    const accessToken = localStorage.getItem("ss_access_token");

    const { data, error } = await supabaseClient.rpc(
        "ss_my_assignment",
        {
            p_access_token: accessToken
        }
    );

    if (error) {
        document.getElementById("roomMessage").textContent =
            error.message;
        return;
    }

    document.getElementById("roomMessage").textContent =
        "🎁 Твой получатель: " + data.recipient;
}
